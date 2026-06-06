// Area-select cropping. The popup shows the captured PNG; the user drags a
// rectangle over the preview; we crop the source PNG (not the rendered <img>)
// at native pixel resolution via OffscreenCanvas.

export class Cropper {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.stage - container holding the <img>
   * @param {HTMLImageElement} opts.preview - the <img> we overlay the crop on
   * @param {HTMLElement} opts.overlay - dimmed crop layer
   * @param {HTMLElement} opts.rect - the selection rectangle inside overlay
   */
  constructor({ stage, preview, overlay, rect }) {
    this.stage = stage;
    this.preview = preview;
    this.overlay = overlay;
    this.rect = rect;
    this.active = false;
    this.start = null;
    this.box = null; // {x,y,w,h} in CSS pixels relative to the preview
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
  }

  enable() {
    this.overlay.hidden = false;
    this.rect.style.display = "none";
    this.box = null;
    this.overlay.addEventListener("pointerdown", this._onDown);
  }

  disable() {
    this.overlay.hidden = true;
    this.rect.style.display = "none";
    this.box = null;
    this.overlay.removeEventListener("pointerdown", this._onDown);
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
  }

  hasSelection() {
    return !!this.box && this.box.w > 4 && this.box.h > 4;
  }

  _onDown(e) {
    const r = this.overlay.getBoundingClientRect();
    this.start = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.active = true;
    this.box = { x: this.start.x, y: this.start.y, w: 0, h: 0 };
    this._paint();
    this.rect.style.display = "block";
    window.addEventListener("pointermove", this._onMove);
    window.addEventListener("pointerup", this._onUp, { once: true });
    e.preventDefault();
  }

  _onMove(e) {
    if (!this.active) return;
    const r = this.overlay.getBoundingClientRect();
    const cur = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.box = {
      x: Math.min(this.start.x, cur.x),
      y: Math.min(this.start.y, cur.y),
      w: Math.abs(cur.x - this.start.x),
      h: Math.abs(cur.y - this.start.y),
    };
    this._paint();
  }

  _onUp() {
    this.active = false;
    window.removeEventListener("pointermove", this._onMove);
  }

  _paint() {
    if (!this.box) return;
    Object.assign(this.rect.style, {
      left: `${this.box.x}px`,
      top: `${this.box.y}px`,
      width: `${this.box.w}px`,
      height: `${this.box.h}px`,
    });
  }

  /**
   * Crop the source PNG using the current selection. Returns a new PNG Blob.
   * The selection rectangle is in CSS pixels relative to the rendered <img>;
   * we convert to source-PNG pixels via the image's natural-to-display ratio.
   */
  async cropToBlob(sourceBlob) {
    if (!this.hasSelection()) throw new Error("No crop selection.");
    const previewRect = this.preview.getBoundingClientRect();
    const overlayRect = this.overlay.getBoundingClientRect();

    // The overlay sits over the stage, but the <img> may be letterboxed inside
    // it. Translate box coords from overlay-space to preview-space.
    const dx = previewRect.left - overlayRect.left;
    const dy = previewRect.top - overlayRect.top;
    const inPreview = {
      x: Math.max(0, this.box.x - dx),
      y: Math.max(0, this.box.y - dy),
      w: Math.min(previewRect.width - Math.max(0, this.box.x - dx), this.box.w),
      h: Math.min(previewRect.height - Math.max(0, this.box.y - dy), this.box.h),
    };
    if (inPreview.w < 2 || inPreview.h < 2) {
      throw new Error("Crop selection is outside the screenshot.");
    }

    const scaleX = this.preview.naturalWidth / previewRect.width;
    const scaleY = this.preview.naturalHeight / previewRect.height;
    const sx = Math.round(inPreview.x * scaleX);
    const sy = Math.round(inPreview.y * scaleY);
    const sw = Math.round(inPreview.w * scaleX);
    const sh = Math.round(inPreview.h * scaleY);

    const bitmap = await createImageBitmap(sourceBlob);
    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    bitmap.close?.();
    return await canvas.convertToBlob({ type: "image/png" });
  }
}
