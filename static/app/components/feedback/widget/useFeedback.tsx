import {useMemo} from 'react';
import type * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useAsyncSDKIntegrationStore from 'sentry/views/app/asyncSDKIntegrationProvider';

export type FeedbackIntegration = NonNullable<ReturnType<typeof Sentry.getFeedback>>;

export type UseFeedbackOptions = Parameters<FeedbackIntegration['createForm']>[0];

export function useFeedback({
  formTitle,
  messagePlaceholder,
  tags,
}: NonNullable<UseFeedbackOptions>): {
  feedback: FeedbackIntegration | undefined;
  options: NonNullable<UseFeedbackOptions>;
} {
  const config = useLegacyStore(ConfigStore);
  const {state} = useAsyncSDKIntegrationStore();

  const feedback = state.Feedback as FeedbackIntegration | undefined;

  const options = useMemo(() => {
    return {
      colorScheme: config.theme === 'dark' ? ('dark' as const) : ('light' as const),
      buttonLabel: t('Give Feedback'),
      submitButtonLabel: t('Send Feedback'),
      messagePlaceholder: messagePlaceholder ?? t('What did you expect?'),
      formTitle: formTitle ?? t('Give Feedback'),
      tags,
    };
  }, [config.theme, formTitle, messagePlaceholder, tags]);

  return {feedback, options};
}
