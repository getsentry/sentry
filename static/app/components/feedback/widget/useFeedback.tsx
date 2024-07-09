import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useAsyncSDKIntegrationStore from 'sentry/views/app/asyncSDKIntegrationProvider';

type FeedbackIntegration = NonNullable<ReturnType<typeof Sentry.getFeedback>>;

export type UseFeedbackOptions = {
  formTitle?: string;
  messagePlaceholder?: string;
};

export function useFeedback({formTitle, messagePlaceholder}: UseFeedbackOptions) {
  const config = useLegacyStore(ConfigStore);
  const {state} = useAsyncSDKIntegrationStore();

  // TODO(ryan953): remove the fallback `?? Sentry.getFeedback()` after
  // getsentry is calling `store.add(feedback);`
  const feedback =
    (state.Feedback as FeedbackIntegration | undefined) ?? Sentry.getFeedback();

  const options = useMemo(() => {
    return {
      colorScheme: config.theme === 'dark' ? ('dark' as const) : ('light' as const),
      buttonLabel: t('Give Feedback'),
      submitButtonLabel: t('Send Feedback'),
      messagePlaceholder: messagePlaceholder ?? t('What did you expect?'),
      formTitle: formTitle ?? t('Give Feedback'),
    };
  }, [config.theme, formTitle, messagePlaceholder]);

  return {feedback, options};
}
