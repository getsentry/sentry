import type {RefObject} from 'react';
import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useAsyncSDKIntegrationStore from 'sentry/views/app/asyncSDKIntegrationProvider';

type FeedbackIntegration = NonNullable<ReturnType<typeof Sentry.getFeedback>>;

interface Props {
  buttonRef?: RefObject<HTMLButtonElement> | RefObject<HTMLAnchorElement>;
  formTitle?: string;
  messagePlaceholder?: string;
}

export default function useFeedbackWidget({
  buttonRef,
  formTitle,
  messagePlaceholder,
}: Props) {
  const config = useLegacyStore(ConfigStore);
  const {state} = useAsyncSDKIntegrationStore();

  // TODO(ryan953): remove the fallback `?? Sentry.getFeedback()` after
  // getsentry is calling `store.add(feedback);`
  const feedback =
    (state.Feedback as FeedbackIntegration | undefined) ?? Sentry.getFeedback();

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const options = {
      colorScheme: config.theme === 'dark' ? ('dark' as const) : ('light' as const),
      buttonLabel: t('Give Feedback'),
      submitButtonLabel: t('Send Feedback'),
      messagePlaceholder: messagePlaceholder ?? t('What did you expect?'),
      formTitle: formTitle ?? t('Give Feedback'),
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
  }, [buttonRef, config.theme, feedback, formTitle, messagePlaceholder]);

  return feedback;
}
