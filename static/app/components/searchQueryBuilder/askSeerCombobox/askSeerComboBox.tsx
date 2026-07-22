import {useState} from 'react';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {useMutation} from '@tanstack/react-query';
import type {MutationOptions} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {AskSeerSearchHeader} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerSearchHeader';
import {AskSeerSearchSkeleton} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerSearchSkeleton';
import {BaseAskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/baseAskSeerComboBox';
import type {QueryTokensProps} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {formatQueryToNaturalLanguage} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

interface AskSeerMutationResult<T extends QueryTokensProps> {
  queries: T[];
  status: string;
  unsupported_reason: string | null;
}

export interface AskSeerComboBoxProps<T extends QueryTokensProps> extends Omit<
  AriaComboBoxProps<unknown>,
  'children'
> {
  applySeerSearchQuery: (item: T) => void;
  askSeerMutationOptions: MutationOptions<AskSeerMutationResult<T>, Error, string>;
  initialQuery: string;
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

  const {mutate, data, isPending, isError} = useMutation({
    ...askSeerMutationOptions,
    onError: (error, variables, onMutateResult, context) => {
      askSeerMutationOptions.onError?.(error, variables, onMutateResult, context);
      addErrorMessage(t('Seer failed to process your search. Please try again.'));
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
      loadingContent={
        <Stack flex="1">
          <AskSeerSearchHeader title={t('Let me think about that...')} loading />
          <AskSeerSearchSkeleton />
        </Stack>
      }
      errorTitle={t('An error occurred while fetching Seer queries')}
      emptyTitle={t("Describe what you're looking for.")}
    />
  );
}
