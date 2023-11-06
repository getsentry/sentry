import {useEffect} from 'react';
import {css, Global} from '@emotion/react';
import {BrowserClient, getCurrentHub} from '@sentry/react';
import {Feedback} from '@sentry-internal/feedback';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import theme from 'sentry/utils/theme';

/**
 * Use this to display the Feedback widget in certain routes/components
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
      buttonLabel: 'Give Feedback',
      submitButtonLabel: 'Send Feedback',
      messagePlaceholder: 'What did you expect?',
      formTitle: 'Give Feedback',
    });
    return () => {
      feedback?.removeWidget(widget);
    };
  }, [widgetTheme]);

  // z-index needs to be below our indicators which is 10001
  return (
    <Global
      styles={css`
        #sentry-feedback {
          --z-index: ${theme.zIndex.toast - 1};
        }
      `}
    />
  );
}
