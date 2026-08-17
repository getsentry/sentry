/**
 * Feature-detects the browser APIs required to export a replay to an MP4
 * client-side: Region Capture (crop a tab-capture stream down to a single
 * element), WebCodecs (encode raw frames without shipping a wasm codec), and
 * the File System Access API (stream the muxed output straight to disk
 * instead of buffering it in memory).
 *
 * As of 2026 this combination is Chromium-only (Chrome/Edge); Firefox and
 * Safari support none of the three.
 */
export function canExportReplayAsVideo(): boolean {
  return (
    typeof window !== 'undefined' &&
    'CropTarget' in window &&
    'MediaStreamTrackProcessor' in window &&
    'VideoEncoder' in window &&
    'showSaveFilePicker' in window &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}
