import type {Guide} from 'sentry/components/assistant/types';

export function handleGuideUpdate(
  nextGuide: Guide | null,
  {dismissed}: {dismissed?: boolean}
) {
  // if not ready, ignore
  if (!globalThis.pendo?.isReady?.()) {
    return;
  }
  // only start Pendo if there is no next guide
  // and the user did not dismiss
  if (!nextGuide && !dismissed) {
    globalThis.pendo.startGuides();
  }
}
