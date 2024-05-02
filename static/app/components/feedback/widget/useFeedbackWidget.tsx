import type {RefObject} from 'react';
import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

interface Props {
  buttonRef?: RefObject<HTMLButtonElement> | RefObject<HTMLAnchorElement>;
  messagePlaceholder?: string;
}

export default function useFeedbackWidget({buttonRef, messagePlaceholder}: Props) {
  const config = useLegacyStore(ConfigStore);
  const feedback = Sentry.getFeedback();

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const options = {
      colorScheme: config.theme === 'dark' ? ('dark' as const) : ('light' as const),
      buttonLabel: t('Give Feedback'),
      submitButtonLabel: t('Send Feedback'),
      messagePlaceholder: messagePlaceholder ?? t('What did you expect?'),
      formTitle: t('Give Feedback'),
    };

    if (buttonRef) {
      if (buttonRef.current) {
        return feedback.attachTo(buttonRef.current, options);
      }
    } else {
      const widget = feedback.createWidget(options);
      return () => {
        widget.removeFromDom();
      };
    }

    return undefined;
  }, [buttonRef, config.theme, feedback, messagePlaceholder]);

  return feedback;
}
