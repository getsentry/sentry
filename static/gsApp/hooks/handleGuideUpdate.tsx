import type {Guide} from 'sentry/components/assistant/types';
import GuideStore from 'sentry/stores/guideStore';

export default function handleGuideUpdate(
  nextGuide: Guide | null,
  {dismissed}: {dismissed?: boolean} = {}
) {
  // Helper that contains the core coordination logic once Pendo *is* ready
  const run = () => {
    const {forceHide} = GuideStore.state;

    // Stop guides if:
    // 1. A Sentry guide is active (nextGuide is truthy)
    // 2. Guides are force-hidden (e.g. a modal is open)
    // 3. User dismissed a Sentry guide (to avoid immediate Pendo takeover)
    if (nextGuide || forceHide || dismissed) {
      window.pendo?.stopGuides?.();
    } else {
      // Only start Pendo guides when no Sentry guides are active *and*
      // guides are not force-hidden.
      window.pendo?.startGuides?.();
    }
  };

  // If Pendo is not ready yet, poll until it is ready, then execute logic
  if (!window.pendo?.isReady?.()) {
    const retryInterval = 100; // ms
    const retry = () => {
      if (window.pendo?.isReady?.()) {
        run();
      } else {
        setTimeout(retry, retryInterval);
      }
    };

    retry();
    return;
  }

  // Pendo is ready – run coordination logic immediately
  run();
}
