import {useMemo} from 'react';
import type * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useAsyncSDKIntegrationStore from 'sentry/views/app/asyncSDKIntegrationProvider';

type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;

export type FeedbackIntegration = NonNullable<ReturnType<typeof Sentry.getFeedback>>;

export type UseFeedbackOptions = ArgumentTypes<FeedbackIntegration['createForm']>[0];

export function useFeedback({
  formTitle,
  messagePlaceholder,
  tags,
}: NonNullable<UseFeedbackOptions>) {
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
