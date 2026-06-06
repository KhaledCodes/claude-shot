// claude-shot native messaging host.
// Reads framed JSON messages from Chrome on stdin and writes responses on
// stdout. Handles two message types: `ping` (health check) and `paste-png`
// (write PNG to system pasteboard, activate target app, post Cmd+V).
//
// macOS only. Built with `swift build -c release`. Installed by
// `scripts/install.sh`. Requires Accessibility permission for the keystroke
// post — granted to this binary's path in System Settings → Privacy &
// Security → Accessibility.

import AppKit
import Foundation

// MARK: - Chrome native-messaging framing

let stdinHandle = FileHandle.standardInput
let stdoutHandle = FileHandle.standardOutput
let stderrHandle = FileHandle.standardError

let HOST_VERSION = "0.1.0"

private let logPath: String = {
  let home = ProcessInfo.processInfo.environment["HOME"] ?? NSHomeDirectory()
  let dir = home + "/Library/Logs/claude-shot"
  try? FileManager.default.createDirectory(
    atPath: dir, withIntermediateDirectories: true)
  return dir + "/host.log"
}()

private let logFormatter: DateFormatter = {
  let f = DateFormatter()
  f.dateFormat = "HH:mm:ss.SSS"
  return f
}()

func log(_ s: String) {
  let line = "[\(logFormatter.string(from: Date()))] \(s)\n"
  try? stderrHandle.write(contentsOf: Data(line.utf8))
  guard let data = line.data(using: .utf8) else { return }
  if FileManager.default.fileExists(atPath: logPath) {
    if let h = FileHandle(forWritingAtPath: logPath) {
      _ = h.seekToEndOfFile()
      try? h.write(contentsOf: data)
      try? h.close()
    }
  } else {
    try? data.write(to: URL(fileURLWithPath: logPath))
  }
}

/// Read one length-prefixed message from stdin. Returns nil when stdin closes.
func readMessage() -> Data? {
  guard let lengthData = try? stdinHandle.read(upToCount: 4),
        lengthData.count == 4 else { return nil }
  var raw: UInt32 = 0
  _ = withUnsafeMutableBytes(of: &raw) { lengthData.copyBytes(to: $0) }
  let len = Int(UInt32(littleEndian: raw))
  if len <= 0 { return Data() }
  // Chrome rejects messages over 1 MB by default; we accept up to 64 MB so a
  // full-page screenshot fits.
  if len > 64 * 1024 * 1024 {
    log("message too large: \(len) bytes")
    return nil
  }
  guard let payload = try? stdinHandle.read(upToCount: len),
        payload.count == len else { return nil }
  return payload
}

func writeMessage(_ data: Data) {
  var length = UInt32(data.count).littleEndian
  let lengthData = withUnsafeBytes(of: &length) { Data($0) }
  try? stdoutHandle.write(contentsOf: lengthData)
  try? stdoutHandle.write(contentsOf: data)
}

// MARK: - Wire types

struct Incoming: Decodable {
  let type: String
  let base64: String?
  let bundleId: String?
}

struct Outgoing: Encodable {
  let ok: Bool
  var target: String? = nil
  var error: String? = nil
  var version: String? = nil
}

// MARK: - Core operations

enum HostError: LocalizedError {
  case pasteboardSetFailed
  case appNotRunning(String)
  case eventConstructFailed
  case missingBase64
  case missingBundleId
  case invalidBase64
  case unknownType(String)
  case accessibilityDenied

  var errorDescription: String? {
    switch self {
    case .pasteboardSetFailed:
      return "Failed to write PNG to NSPasteboard."
    case .appNotRunning(let id):
      return "Target app is not running: \(id). Open it first, then try again."
    case .eventConstructFailed:
      return "Couldn't construct keyboard event (CGEventSource returned nil)."
    case .missingBase64:
      return "paste-png message had no base64 payload."
    case .missingBundleId:
      return "paste-png message had no bundleId."
    case .invalidBase64:
      return "Could not decode base64 payload."
    case .unknownType(let t):
      return "Unknown message type: \(t)"
    case .accessibilityDenied:
      return "Accessibility permission not granted. Enable claude-shot-host in System Settings → Privacy & Security → Accessibility."
    }
  }
}

func writePngToPasteboard(_ data: Data) throws {
  let pb = NSPasteboard.general
  pb.clearContents()
  let ok = pb.setData(data, forType: .png)
  if !ok { throw HostError.pasteboardSetFailed }
}

func activateApp(bundleId: String) throws -> String {
  let running = NSRunningApplication.runningApplications(
    withBundleIdentifier: bundleId)
  guard let app = running.first else {
    throw HostError.appNotRunning(bundleId)
  }
  app.activate(options: [.activateIgnoringOtherApps])
  // Poll NSWorkspace.frontmostApplication until the target is actually
  // frontmost (or until we hit a 600ms cap). A fixed sleep was racy —
  // activation can take 50ms or 350ms depending on Spaces, window count,
  // and whether the app was hidden. Posting ⌘V before activation completes
  // delivers the keystroke to whatever app *was* frontmost (usually Chrome).
  let deadline = Date().addingTimeInterval(0.6)
  while Date() < deadline {
    let front = NSWorkspace.shared.frontmostApplication?.bundleIdentifier
    if front == bundleId { break }
    Thread.sleep(forTimeInterval: 0.015)
  }
  // Tiny settle delay after frontmost is confirmed, so the destination app's
  // focused-view tracking has caught up before the keystroke lands.
  Thread.sleep(forTimeInterval: 0.04)
  return app.localizedName ?? bundleId
}

/// Synthesize Cmd+V into the currently-focused app. Requires Accessibility
/// permission for this binary.
func postCommandV() throws {
  if !AXIsProcessTrusted() {
    // The prompting variant of the trust check. macOS may show a banner /
    // prompt the first time this runs, *if* TCC considers the calling
    // context eligible. For stdio subprocesses of Chrome the prompt is
    // often suppressed, but firing this is the best we can do from here.
    let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
    let opts = [key: true] as CFDictionary
    _ = AXIsProcessTrustedWithOptions(opts)
    throw HostError.accessibilityDenied
  }
  // Wait briefly for any held modifier keys to be released. This prevents
  // bleed-through from the hotkey: if the user is still pressing ⌘⇧ when we
  // post our event, the system can merge those flags in and turn ⌘V into
  // ⌘⇧V (which terminals ignore). We poll the live HID flag state — this is
  // observable from any process, no special permission needed.
  let interfering: CGEventFlags = [
    .maskCommand, .maskShift, .maskAlternate, .maskControl,
  ]
  let waitStart = Date()
  let waitDeadline = waitStart.addingTimeInterval(0.5)
  let initialFlags = CGEventSource.flagsState(.combinedSessionState)
  while Date() < waitDeadline {
    let live = CGEventSource.flagsState(.combinedSessionState)
    if live.intersection(interfering).rawValue == 0 { break }
    Thread.sleep(forTimeInterval: 0.015)
  }
  let finalFlags = CGEventSource.flagsState(.combinedSessionState)
  let elapsed = Date().timeIntervalSince(waitStart)
  log("postCommandV: modifier wait done, elapsed=\(String(format: "%.3f", elapsed))s, initial=\(initialFlags.rawValue), final=\(finalFlags.rawValue)")

  // .combinedSessionState makes the event part of the user's HID session, so
  // applications (terminals, VS Code's xterm.js, etc.) actually receive and
  // interpret it. .privateState looked attractive for isolating modifier
  // bleed, but it produces events apps don't accept.
  let src = CGEventSource(stateID: .combinedSessionState)
  let vKey: CGKeyCode = 0x09  // ANSI 'v'
  guard
    let keyDown = CGEvent(keyboardEventSource: src, virtualKey: vKey, keyDown: true),
    let keyUp = CGEvent(keyboardEventSource: src, virtualKey: vKey, keyDown: false)
  else {
    throw HostError.eventConstructFailed
  }
  keyDown.flags = .maskCommand
  keyUp.flags = .maskCommand
  log("postCommandV: posting keyDown via .cghidEventTap")
  keyDown.post(tap: .cghidEventTap)
  log("postCommandV: posting keyUp via .cghidEventTap")
  keyUp.post(tap: .cghidEventTap)
  log("postCommandV: both posts returned")
}

// MARK: - Message dispatch

func handle(_ msg: Incoming) throws -> Outgoing {
  switch msg.type {
  case "ping":
    return Outgoing(ok: true, version: HOST_VERSION)
  case "paste-png":
    log("paste-png: start, bundleId=\(msg.bundleId ?? "nil")")
    guard let b64 = msg.base64, !b64.isEmpty else { throw HostError.missingBase64 }
    guard let bundleId = msg.bundleId, !bundleId.isEmpty else {
      throw HostError.missingBundleId
    }
    guard let png = Data(base64Encoded: b64) else { throw HostError.invalidBase64 }
    log("paste-png: decoded PNG, bytes=\(png.count)")
    try writePngToPasteboard(png)
    log("paste-png: pasteboard write ok")
    let beforeFront = NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "?"
    log("paste-png: frontmost before activate=\(beforeFront)")
    let target = try activateApp(bundleId: bundleId)
    let afterFront = NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "?"
    log("paste-png: activated, target=\(target), frontmost=\(afterFront)")
    log("paste-png: AXIsProcessTrusted=\(AXIsProcessTrusted())")
    try postCommandV()
    log("paste-png: posted ⌘V, complete")
    return Outgoing(ok: true, target: target)
  default:
    throw HostError.unknownType(msg.type)
  }
}

// MARK: - Main loop

let decoder = JSONDecoder()
let encoder = JSONEncoder()

while let data = readMessage() {
  if data.isEmpty { break }
  let response: Outgoing
  do {
    let incoming = try decoder.decode(Incoming.self, from: data)
    response = try handle(incoming)
  } catch let e as HostError {
    response = Outgoing(ok: false, error: e.errorDescription ?? "Unknown error")
  } catch {
    response = Outgoing(
      ok: false, error: "Decode/handle error: \(error.localizedDescription)")
  }
  if let out = try? encoder.encode(response) {
    writeMessage(out)
  }
}
