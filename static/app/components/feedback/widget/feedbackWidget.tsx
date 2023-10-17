import {useEffect} from 'react';
import {BrowserClient, getCurrentHub} from '@sentry/react';
import {Feedback} from '@sentry-internal/feedback';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

/**
 * The "Widget" connects the default Feedback button with the Feedback Modal
 *
 * XXX: this is temporary while we make this an SDK feature.
 */
export default function FeedbackWidget() {
  const config = useLegacyStore(ConfigStore);
  const widgetTheme = config.theme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    const hub = getCurrentHub();
    const client = hub && hub.getClient<BrowserClient>();
    const feedback = client?.getIntegration(Feedback);
    const widget = feedback?.createWidget({
      colorScheme: widgetTheme,
    });
    return () => {
      feedback?.removeWidget(widget);
    };
  }, [widgetTheme]);

  return null;
}
