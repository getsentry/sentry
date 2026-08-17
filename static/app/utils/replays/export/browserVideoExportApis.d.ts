/**
 * Ambient types for browser APIs used by the replay-to-video export
 * feature that aren't yet part of TypeScript's DOM lib: Region Capture
 * (`CropTarget`, `MediaStreamTrack.cropTo`), `MediaStreamTrackProcessor`,
 * and the `preferCurrentTab` option on `getDisplayMedia`. All three are
 * Chromium-only proposals; see `replayVideoExportSupport.tsx` for the
 * runtime feature-detection this relies on.
 */

declare class CropTarget {
  static fromElement(element: Element): Promise<CropTarget>;
}

interface MediaStreamTrack {
  cropTo?(cropTarget: CropTarget): Promise<void>;
}

interface DisplayMediaStreamOptions {
  preferCurrentTab?: boolean;
}

interface MediaStreamTrackProcessorInit {
  track: MediaStreamTrack;
}

declare class MediaStreamTrackProcessor {
  constructor(init: MediaStreamTrackProcessorInit);
  readonly readable: ReadableStream<VideoFrame>;
}

interface SaveFilePickerOptions {
  excludeAcceptAllOption?: boolean;
  suggestedName?: string;
  types?: Array<{
    accept: Record<string, string[]>;
    description?: string;
  }>;
}

interface Window {
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
