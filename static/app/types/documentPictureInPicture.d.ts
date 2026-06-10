// Type definitions for the Document Picture-in-Picture API
// https://developer.mozilla.org/en-US/docs/Web/API/DocumentPictureInPicture
//
// These are not (yet) part of the TypeScript DOM lib, so we declare the minimal
// surface we use here.

interface DocumentPictureInPictureOptions {
  /**
   * Hides the "back to tab" button in the picture-in-picture window.
   */
  disallowReturnToOpener?: boolean;
  /**
   * The initial height of the picture-in-picture window in pixels.
   */
  height?: number;
  /**
   * Uses the default window placement instead of remembering the previous one.
   */
  preferInitialWindowPlacement?: boolean;
  /**
   * The initial width of the picture-in-picture window in pixels.
   */
  width?: number;
}

interface DocumentPictureInPicture extends EventTarget {
  readonly window: Window | null;
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
}

interface Window {
  readonly documentPictureInPicture?: DocumentPictureInPicture;
}
