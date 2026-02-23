import {Replayer} from '@sentry-internal/rrweb';
import {domToCanvas} from 'modern-screenshot';

import type {RecordingFrame} from 'sentry/utils/replays/types';

import type {CaptureFramesArgs} from './types';

/**
 * Creates a hidden but *sized* player suitable for screenshot capture.
 *
 * Unlike `createHiddenPlayer` (which renders at 0×0), this version gives the
 * container real dimensions so the rrweb Replayer lays out the DOM at a size
 * we can actually screenshot.
 *
 * The container is positioned off-screen so it's invisible to the user.
 */
function createScreenshotPlayer(rrwebEvents: RecordingFrame[]): {
  cleanupReplayer: () => void;
  replayer: Replayer;
} {
  const domRoot = document.createElement('div');
  domRoot.className = 'sentry-block';
  const {style} = domRoot;

  // Position off-screen but with real dimensions so the DOM is laid out
  style.position = 'fixed';
  style.left = '-99999px';
  style.top = '0';
  style.width = '1280px';
  style.height = '720px';
  style.overflow = 'hidden';

  document.body.appendChild(domRoot);

  const replayer = new Replayer(
    // Deep clone to avoid mutation issues when multiple Replayer instances exist
    structuredClone(rrwebEvents),
    {
      root: domRoot,
      loadTimeout: 1,
      showWarning: false,
      blockClass: 'sentry-block',
      speed: 99999,
      skipInactive: true,
      triggerFocus: false,
      mouseTail: false,
    }
  );

  const cleanupReplayer = () => {
    replayer.destroy();
    domRoot.remove();
  };

  return {replayer, cleanupReplayer};
}

/**
 * Wait for the next N animation frames to allow rrweb to finish rendering.
 */
function waitForRender(n = 2): Promise<void> {
  return new Promise(resolve => {
    let remaining = n;
    function tick() {
      remaining--;
      if (remaining <= 0) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  });
}

/**
 * Steps through a replay at fixed intervals and captures each frame as a JPEG blob
 * using `modern-screenshot`'s `domToCanvas`.
 *
 * This leverages rrweb's `Replayer.pause(offset)` to seek to each timestamp,
 * waits for the DOM to settle, then screenshots the iframe's contentDocument.
 *
 * Returns an object with the captured frame blobs and the detected
 * width / height of the replay viewport (from the rrweb iframe).
 */
export async function captureReplayFrames({
  rrwebEvents,
  startTimestampMs: _startTimestampMs,
  durationMs,
  fps = 4,
  onProgress,
  signal,
}: CaptureFramesArgs): Promise<{frames: Blob[]; height: number; width: number}> {
  const stepMs = 1000 / fps;
  const frameCount = Math.max(1, Math.ceil(durationMs / stepMs));

  const {replayer, cleanupReplayer} = createScreenshotPlayer(
    rrwebEvents as RecordingFrame[]
  );

  const frames: Blob[] = [];
  let detectedWidth = 0;
  let detectedHeight = 0;

  try {
    for (let i = 0; i < frameCount; i++) {
      if (signal?.aborted) {
        throw new DOMException('Export cancelled', 'AbortError');
      }

      const offsetMs = i * stepMs;

      // Seek the replayer to this point in time
      replayer.pause(offsetMs);

      // Wait for rrweb to finish applying DOM mutations
      await waitForRender(3);

      const iframeDoc = replayer.iframe.contentDocument;
      if (!iframeDoc) {
        throw new Error('Cannot access replay iframe contentDocument');
      }

      const docEl = iframeDoc.documentElement;

      // Detect dimensions from the iframe's actual rendered size
      if (detectedWidth === 0) {
        detectedWidth = replayer.iframe.clientWidth || docEl.scrollWidth || 1280;
        detectedHeight = replayer.iframe.clientHeight || docEl.scrollHeight || 720;
      }

      // Use modern-screenshot to serialize the DOM into a canvas.
      // This handles inline styles, pseudo-elements, etc. from the
      // reconstructed rrweb DOM.
      const canvas = await domToCanvas(docEl, {
        width: detectedWidth,
        height: detectedHeight,
      });

      // Convert canvas to JPEG blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          b => {
            if (b) {
              resolve(b);
            } else {
              reject(new Error(`Failed to capture frame ${i}`));
            }
          },
          'image/jpeg',
          0.85
        );
      });

      frames.push(blob);

      onProgress?.({
        phase: 'capturing',
        current: i + 1,
        total: frameCount,
      });
    }
  } finally {
    cleanupReplayer();
  }

  return {frames, width: detectedWidth, height: detectedHeight};
}
