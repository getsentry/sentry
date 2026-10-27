import {useMemo} from 'react';
import type * as Sentry from '@sentry/react';
import {useSelector} from '@tanstack/react-store';

import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useAsyncSDKIntegrationStore} from 'sentry/views/app/asyncSDKIntegrationProvider';

export type FeedbackIntegration = NonNullable<ReturnType<typeof Sentry.getFeedback>>;

export type UseFeedbackOptions = Parameters<FeedbackIntegration['createForm']>[0];

export function useFeedbackSDKIntegration(): {
  defaultOptions: NonNullable<UseFeedbackOptions>;
  feedback: FeedbackIntegration | undefined;
} {
  const colorMode = useSelector(ConfigStore.store, state => state.theme);
  const {state} = useAsyncSDKIntegrationStore();

  const feedback = state.Feedback as FeedbackIntegration | undefined;

  const defaultOptions = useMemo((): NonNullable<UseFeedbackOptions> => {
    return {
      colorScheme: colorMode === 'dark' ? ('dark' as const) : ('light' as const),
      submitButtonLabel: t('Send Feedback'),
      messagePlaceholder: t('What did you expect?'),
      formTitle: t('Give Feedback'),
    };
  }, [colorMode]);

  return {feedback, defaultOptions};
}
