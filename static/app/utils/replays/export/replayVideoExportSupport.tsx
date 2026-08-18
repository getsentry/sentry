/**
 * Feature-detects the browser APIs required to *capture* a replay to video
 * client-side: Region Capture (crop a tab-capture stream down to the player
 * element) and `MediaStreamTrackProcessor` (turn that stream into raw
 * frames). Encoding itself happens in ffmpeg.wasm, which has no special
 * browser support requirement beyond WebAssembly. The result is downloaded
 * as a plain Blob (not `showSaveFilePicker`, which isn't available in every
 * Chromium-based browser — Brave disables it outright), so saving imposes
 * no extra requirement here either.
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
