import {RefObject, useEffect} from 'react';
import {Feedback, getCurrentHub} from '@sentry/react';

import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

interface Props {
  buttonRef?: RefObject<HTMLButtonElement>;
}

export default function useFeedbackWidget({buttonRef}: Props) {
  const config = useLegacyStore(ConfigStore);
  const hub = getCurrentHub();
  const feedback = hub.getIntegration(Feedback);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const options = {
      colorScheme: config.theme === 'dark' ? ('dark' as const) : ('light' as const),
      buttonLabel: t('Give Feedback'),
      submitButtonLabel: t('Send Feedback'),
      messagePlaceholder: t('What did you expect?'),
      formTitle: t('Give Feedback'),
    };

    if (buttonRef) {
      if (buttonRef.current) {
        const widget = feedback.attachTo(buttonRef.current, options);
        return () => {
          feedback.removeWidget(widget);
        };
      }
    } else {
      const widget = feedback.createWidget(options);
      return () => {
        feedback.removeWidget(widget);
      };
    }

    return undefined;
  }, [buttonRef, config.theme, feedback]);

  return feedback;
}
