import {Replayer} from '@sentry-internal/rrweb';

import type {RecordingFrame} from 'sentry/utils/replays/types';

export function createHiddenPlayer(rrwebEvents: RecordingFrame[]): {
  cleanupReplayer: () => void;
  replayer: Replayer;
} {
  const domRoot = document.createElement('div');
  domRoot.className = 'sentry-block';
  const {style} = domRoot;

  style.position = 'fixed';
  style.inset = '0';
  style.width = '0';
  style.height = '0';
  style.overflow = 'hidden';

  // create a hidden iframe
  const hiddenIframe = document.createElement('iframe');
  hiddenIframe.style.display = 'none';
  document.body.appendChild(hiddenIframe);

  // append the DOM root inside the iframe
  if (hiddenIframe.contentDocument) {
    hiddenIframe.contentDocument.body.appendChild(domRoot);
  }

  const replayer = new Replayer(
    // We need to deep clone the events since `Replayer` can mutate the event
    // objects. This means that having multiple Replayer instances (e.g. the
    // Replay details player and a hidden player via `replayStepper`) can cause
    // playback issues as the object references are the same, even though the
    // arrays are not.
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
    hiddenIframe.remove();
    replayer.destroy();
  };

  return {
    replayer,
    cleanupReplayer,
  };
}
