import type {ReactNode} from 'react';
import {useId, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {QueryKey, UseQueryOptions} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Select, type SelectValue} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {fzf} from 'sentry/utils/search/fzf';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

const SEARCH_DEBOUNCE_MS = 300;

type AdminSearchComboboxOption<TResult> = SelectValue<string> &
  ({kind: 'query'; query: string} | {kind: 'result'; result: TResult});

function getBestMatchScore(searchTerms: readonly string[], query: string) {
  const normalizedQuery = query.toLowerCase();
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const searchTerm of searchTerms) {
    const match = fzf(searchTerm, normalizedQuery, false);
    if (match.end !== -1) {
      bestScore = Math.max(bestScore, match.score);
    }
  }

  return bestScore;
}

type AdminSearchComboboxProps<TQueryData, TResult, TQueryKey extends QueryKey> = {
  getResultKey: (result: TResult) => string;
  getResultSearchTerms: (result: TResult) => readonly string[];
  label: string;
  onSelectResult: (result: TResult) => void;
  queryOptions: (
    query: string
  ) => UseQueryOptions<TQueryData, Error, readonly TResult[], TQueryKey>;
  renderResult: (result: TResult) => ReactNode;
  isExactMatch?: (result: TResult, query: string) => boolean;
  onSearch?: (query: string) => void;
  placeholder?: string;
};

export function AdminSearchCombobox<TQueryData, TResult, TQueryKey extends QueryKey>({
  getResultKey,
  getResultSearchTerms,
  isExactMatch,
  label,
  onSearch,
  onSelectResult,
  placeholder = label,
  queryOptions,
  renderResult,
}: AdminSearchComboboxProps<TQueryData, TResult, TQueryKey>) {
  const inputId = useId();
  const theme = useTheme();
  const [inputValue, setInputValue] = useState('');
  const normalizedInput = inputValue.trim();
  const hasInput = normalizedInput.length > 0;
  const debouncedQuery = useDebouncedValue(normalizedInput, SEARCH_DEBOUNCE_MS);

  const options = queryOptions(debouncedQuery);
  const query = useQuery({
    ...options,
    enabled: hasInput && debouncedQuery.length > 0 && options.enabled !== false,
  });

  const hasSettledInput = normalizedInput === debouncedQuery;
  const resultOptions: Array<AdminSearchComboboxOption<TResult>> = hasSettledInput
    ? (query.data ?? [])
        .map(result => {
          const searchTerms = getResultSearchTerms(result);
          return {
            isExactMatch: isExactMatch?.(result, debouncedQuery) ?? false,
            result,
            score: getBestMatchScore(searchTerms, debouncedQuery),
            searchTerms,
          };
        })
        .toSorted(
          (a, b) => Number(b.isExactMatch) - Number(a.isExactMatch) || b.score - a.score
        )
        .map(({result, searchTerms}) => ({
          kind: 'result',
          result,
          value: `result:${getResultKey(result)}`,
          label: renderResult(result),
          textValue: searchTerms.join(' '),
        }))
    : [];
  const selectOptions =
    onSearch && hasInput
      ? [
          {
            kind: 'query',
            query: normalizedInput,
            value: `query:${normalizedInput}`,
            label: `Search ${label.toLowerCase()} for "${normalizedInput}"`,
          } satisfies AdminSearchComboboxOption<TResult>,
          ...resultOptions,
        ]
      : resultOptions;
  const isLoading = hasInput && (!hasSettledInput || query.isFetching);

  return (
    <Stack gap="sm">
      <Text as="label" htmlFor={inputId} bold>
        {label}
      </Text>
      <Select<AdminSearchComboboxOption<TResult>>
        inputId={inputId}
        inputValue={inputValue}
        isLoading={isLoading}
        isSearchable
        openMenuOnClick={hasInput}
        openMenuOnFocus={hasInput}
        options={selectOptions}
        placeholder={placeholder}
        styles={{
          control: provided => ({
            ...provided,
            backgroundColor: theme.tokens.background.primary,
          }),
        }}
        value={null}
        components={{
          DropdownIndicator: null,
          LoadingMessage: () => (
            <Flex align="center" justify="center" padding="md">
              <Text size="md" variant="muted">
                Loading results…
              </Text>
            </Flex>
          ),
        }}
        filterOption={null}
        noOptionsMessage={() =>
          query.isError ? 'Unable to load results' : 'No results found'
        }
        onInputChange={(value, action) => {
          if (action.action !== 'input-change') {
            return;
          }
          setInputValue(value);
        }}
        onChange={option => {
          if (option.kind === 'query') {
            onSearch?.(option.query);
          } else {
            onSelectResult(option.result);
          }
        }}
      />
      {hasSettledInput && query.error && (
        <Text as="div" role="alert" size="sm" variant="danger">
          {query.error.message}
        </Text>
      )}
    </Stack>
  );
}
