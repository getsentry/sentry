import {useState} from 'react';
import {type AriaComboBoxProps} from '@react-aria/combobox';
import {useMutation} from '@tanstack/react-query';
import type {MutationOptions} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {AskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import type {QueryTokensProps} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {formatQueryToNaturalLanguage} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';

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
  const [searchQuery, setSearchQuery] = useState(() =>
    formatQueryToNaturalLanguage(initialQuery)
  );

  const {
    mutate: submitQuery,
    data,
    error,
    isPending,
    isError,
  } = useMutation({
    ...askSeerMutationOptions,
    onError: (mutationError, variables, onMutateResult, context) => {
      askSeerMutationOptions.onError?.(mutationError, variables, onMutateResult, context);
      addErrorMessage(t('Seer failed to process your search. Please try again.'));
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
      errorAnalytics={{
        statusCode: error instanceof RequestError ? error.status : undefined,
      }}
      unsupportedReason={data?.unsupported_reason}
    />
  );
}
