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
  const feedback =
    Sentry.getClient()?.getIntegrationByName<
      ReturnType<typeof Sentry.feedbackIntegration>
    >('Feedback');

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
        // TODO: Remove this after we update to 8.0.0-beta.5
        // @ts-expect-error This is wrongly typed in the current version...
        return feedback.attachTo(buttonRef.current, options);
      }
    } else {
      // TODO: Remove this after we update to 8.0.0-beta.5
      // @ts-expect-error This is wrongly typed in the current version...
      const widgetPromise = feedback.createWidget(options);
      return async () => {
        const widget = await widgetPromise;
        widget.removeFromDom();
      };
    }

    return undefined;
  }, [buttonRef, config.theme, feedback, messagePlaceholder]);

  return feedback;
}
