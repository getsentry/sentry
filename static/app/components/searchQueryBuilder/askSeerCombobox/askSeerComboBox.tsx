import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import type {MutationOptions} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';
import {toast} from '@sentry/scraps/toast';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

import {AskSeerSearchHeader} from './askSeerSearchHeader';
import {AskSeerSearchSkeleton} from './askSeerSearchSkeleton';
import {BaseAskSeerComboBox} from './baseAskSeerComboBox';
import type {QueryTokensProps} from './types';
import {formatQueryToNaturalLanguage, getAskSeerErrorMessage} from './utils';

interface AskSeerMutationResult<T extends QueryTokensProps> {
  queries: T[];
  status: string;
  unsupported_reason: string | null;
}

export interface AskSeerComboBoxProps<T extends QueryTokensProps> {
  applySeerSearchQuery: (item: T) => void;
  askSeerMutationOptions: MutationOptions<AskSeerMutationResult<T>, Error, string>;
  initialQuery: string;
  className?: string;
}

export function AskSeerComboBox<T extends QueryTokensProps>({
  initialQuery,
  askSeerMutationOptions,
  ...props
}: AskSeerComboBoxProps<T>) {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();
  const [searchQuery, setSearchQuery] = useState(() =>
    formatQueryToNaturalLanguage(initialQuery)
  );

  const {
    mutate,
    data,
    error: mutationError,
    isPending,
    isError,
  } = useMutation({
    ...askSeerMutationOptions,
    onError: (error, variables, onMutateResult, context) => {
      askSeerMutationOptions.onError?.(error, variables, onMutateResult, context);
      toast.error(
        getAskSeerErrorMessage(
          error,
          t('Seer failed to process your search. Please try again.')
        )
      );
      trackAnalytics('ai_query.error', {
        organization,
        area: analyticsArea,
        natural_language_query: variables,
        status_code: error instanceof RequestError ? error.status : undefined,
      });
    },
  });

  return (
    <BaseAskSeerComboBox
      {...props}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      queries={data?.queries ?? []}
      unsupportedReason={data?.unsupported_reason}
      submitQuery={mutate}
      isPending={isPending}
      isError={isError}
      hasResponse={data !== undefined}
      loadingContent={
        <Stack flex="1">
          <AskSeerSearchHeader title={t('Let me think about that...')} loading />
          <AskSeerSearchSkeleton />
        </Stack>
      }
      errorTitle={getAskSeerErrorMessage(
        mutationError,
        t('An error occurred while fetching Seer queries')
      )}
      emptyTitle={t("Describe what you're looking for.")}
    />
  );
}
