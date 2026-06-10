# Going public on the Chrome Web Store: steps

Your item is already on the store as **Unlisted**. This guide takes you through
(1) pushing the cleaned-up build, and (2) flipping visibility to **Public**.

Upload artifact: `dist/claude-shot-0.1.1.zip` (version 0.1.1, debug logs stripped).

---

## 0. Before you start (a few minutes)

**Host the privacy policy at a public URL.** A public listing requires one.
Easiest option, a GitHub Gist:
1. Go to https://gist.github.com
2. Filename `claude-shot-privacy.md`, paste the contents of `PRIVACY.md`.
3. "Create public gist" → copy the URL. That's your Privacy policy URL.
(If claude-shot has a GitHub repo, linking PRIVACY.md there works too.)

**Have at least one screenshot ready** (1280×800 or 640×400). A public listing
with zero screenshots looks broken and reviewers may bounce it. See ideas in
`STORE_LISTING.md`.

---

## 1. Upload the new build (0.1.1)

1. Open the dashboard: https://chrome.google.com/webstore/devconsole
2. Click the **claude-shot** item.
3. Left sidebar → **Package** → **Upload new package**.
4. Select `dist/claude-shot-0.1.1.zip`.
   - If it complains the version isn't higher, the store already has 0.1.1, bump
     the `version` in `extension/manifest.json` again, re-run `./package.sh`, and
     re-upload.

## 2. Fill in the listing (Store listing tab)

Use the copy in `STORE_LISTING.md`:
- **Description** → the "Detailed description" block.
- **Category** → Developer Tools.
- **Screenshots** → upload at least one.
- **Store icon** → 128×128 (the current one is a placeholder; replace if you
  want stronger branding before going public, optional, not blocking).

## 3. Privacy practices tab

- **Single purpose** → the "Single purpose" text from `STORE_LISTING.md`.
- **Permission justifications** → paste each one (see `STORE_LISTING.md`).
- **Data usage** → leave all data-type boxes unchecked; tick the three
  certifications.
- **Privacy policy URL** → the gist/repo URL from step 0.
- **Remote code** → "No, I am not using remote code."

## 4. Flip visibility to Public

1. Left sidebar → **Distribution** (a.k.a. Visibility).
2. Change **Unlisted** → **Public**.
3. Region availability → all regions (or restrict if you prefer).

## 5. Submit

1. Top-right → **Submit for review**.
2. If a "Why are you requesting these permissions?" dialog appears, the
   justifications you saved cover it, confirm and submit.

Review typically takes a few hours to a few days. You'll get an email on
approval or rejection. The extension stays available as unlisted in the meantime.

---

## Heads-up: trademark review risk (going public)

The name "claude-shot" and the route-to-Claude branding use Anthropic's "Claude"
mark. Unlisted listings get little scrutiny here; **public** ones get more. If
review flags it, the usual fixes are:
- Add a clear disclaimer (already in the description: "Not affiliated with…
  'Claude' is a trademark of Anthropic"), and/or
- Adjust the name to something descriptive (e.g. "Screenshot to Claude" reads as
  a description of function rather than a brand) if they require it.

You don't need to act on this pre-emptively, just know it's the most likely
reason a public submission of this particular extension could come back, and the
disclaimer line is already in place to head it off.
