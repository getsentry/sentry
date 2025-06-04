import type {Guide} from 'sentry/components/assistant/types';

export default function handleGuideUpdate(
  nextGuide: Guide | null,
  {dismissed}: {dismissed?: boolean}
) {
  // if not ready, ignore
  if (!window.pendo?.isReady?.()) {
    return;
  }
  // only start Pendo if there is no next guide
  // and the user did not dismiss
  if (!nextGuide && !dismissed) {
    window.pendo.startGuides();
  }
}
