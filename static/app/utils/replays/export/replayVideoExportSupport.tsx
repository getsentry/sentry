/**
 * Feature-detects the browser APIs required to *capture* a replay to video
 * client-side: Region Capture (crop a tab-capture stream down to the player
 * element) and `MediaStreamTrackProcessor` (turn that stream into raw
 * frames). Encoding itself happens in ffmpeg.wasm, which has no special
 * browser support requirement beyond WebAssembly and Workers.
 *
 * Saving the result is a separate concern — see
 * `useExportReplayVideo`'s use of `showSaveFilePicker`, which some
 * Chromium-based browsers (notably Brave, which disables the whole File
 * System Access API for privacy reasons) don't support. That's handled with
 * a runtime fallback to a normal browser download rather than gating this
 * feature-detect, so this function should stay true for any Chromium-based
 * browser that can actually capture frames.
 *
 * As of 2026 Region Capture and MediaStreamTrackProcessor are Chromium-only;
 * Firefox and Safari support neither.
 */
export function canExportReplayAsVideo(): boolean {
  return (
    typeof window !== 'undefined' &&
    'CropTarget' in window &&
    'MediaStreamTrackProcessor' in window &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}
