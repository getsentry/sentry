import {useEffect} from 'react';
import {css, Global} from '@emotion/react';
import {Feedback, getCurrentHub} from '@sentry/react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import theme from 'sentry/utils/theme';

/**
 * Use this to display the Feedback widget in certain routes/components
 */
export default function FloatingFeedbackWidget() {
  const config = useLegacyStore(ConfigStore);
  const hub = getCurrentHub();
  const feedback = hub.getIntegration(Feedback);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const widget = feedback?.createWidget({
      colorScheme: config.theme === 'dark' ? 'dark' : 'light',
      buttonLabel: 'Give Feedback',
      submitButtonLabel: 'Send Feedback',
      messagePlaceholder: 'What did you expect?',
      formTitle: 'Give Feedback',
    });

    return () => {
      feedback?.removeWidget(widget);
    };
  }, [config.theme, feedback]);

  // Do not do anything if Feedback integration is not enabled
  if (!feedback) {
    return null;
  }

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
