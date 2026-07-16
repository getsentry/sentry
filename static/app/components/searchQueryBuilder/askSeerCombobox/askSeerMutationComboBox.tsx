import {useState} from 'react';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {useMutation} from '@tanstack/react-query';
import type {MutationOptions} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import type {QueryTokensProps} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {formatQueryToNaturalLanguage} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

interface AskSeerMutationComboBoxProps<T extends QueryTokensProps> extends Omit<
  AriaComboBoxProps<unknown>,
  'children'
> {
  applySeerSearchQuery: (item: T) => void;
  askSeerMutationOptions: MutationOptions<
    {
      queries: T[];
      status: string;
      unsupported_reason: string | null;
    },
    Error,
    string
  >;
  initialQuery: string;
}

export function AskSeerMutationComboBox<T extends QueryTokensProps>({
  initialQuery,
  askSeerMutationOptions,
  ...props
}: AskSeerMutationComboBoxProps<T>) {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();
  const [searchQuery, setSearchQuery] = useState(() =>
    formatQueryToNaturalLanguage(initialQuery)
  );

  const {
    mutate: submitQuery,
    data,
    isPending,
    isError,
  } = useMutation({
    ...askSeerMutationOptions,
    onError: (error, variables, onMutateResult, context) => {
      askSeerMutationOptions.onError?.(error, variables, onMutateResult, context);
      addErrorMessage(t('Seer failed to process your search. Please try again.'));
      trackAnalytics('ai_query.error', {
        organization,
        area: analyticsArea,
        natural_language_query: searchQuery,
        status_code: error instanceof RequestError ? error.status : undefined,
      });
    },
  });

  return (
    <AskSeerComboBox
      {...props}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      queries={data?.queries ?? []}
      submitQuery={submitQuery}
      isPending={isPending}
      isError={isError}
      unsupportedReason={data?.unsupported_reason}
    />
  );
}
