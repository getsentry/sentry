import {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Client} from 'sentry/api';
import {
  CompactSelect,
  type SelectOption,
  type SingleSelectProps,
} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

type AsyncCompactSelectProps<Value extends string> = Omit<
  SingleSelectProps<Value>,
  'options' | 'searchable' | 'disableSearchFilter' | 'loading' | 'onSearch'
> & {
  /**
   * Function to transform query string into API params
   */
  onQuery: (query: string) => Record<string, any>;
  /**
   * Function to transform API response into options
   */
  onResults: (data: any) => Array<SelectOption<Value>>;
  /**
   * URL to fetch options from
   */
  url: string;
  /**
   * Initial options to show before search
   */
  defaultOptions?: Array<SelectOption<Value>>;
};

/**
 * AsyncCompactSelect combines CompactSelect's button-trigger UI with async search capabilities.
 * It fetches options from an API endpoint as the user types.
 */
export function AsyncCompactSelect<Value extends string = string>({
  url,
  onQuery,
  onResults,
  defaultOptions,
  clearable: _clearable,
  onChange,
  onOpenChange,
  emptyMessage,
  ...compactSelectProps
}: AsyncCompactSelectProps<Value>) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  // Use empty baseUrl since /extensions/ endpoints are not under /api/0/
  const apiRef = useRef(new Client({baseUrl: '', headers: {}}));

  useEffect(() => {
    const api = apiRef.current;
    return () => {
      api.clear();
    };
  }, []);

  const {data, isPending} = useQuery({
    queryKey: [url, onQuery(debouncedQuery)],
    queryFn: async () => {
      // This exists because /extensions/type/search API is not prefixed with /api/0/
      // We do this in the externalIssues modal as well unfortunately.
      const response = await apiRef.current.requestPromise(url, {
        query: onQuery(debouncedQuery),
      });
      return response;
    },
    enabled: !!debouncedQuery,
    staleTime: 0,
  });

  const options = data ? onResults(data) : defaultOptions || [];

  const handleSearch = (value: string) => {
    setQuery(value);
  };

  const handleChange = (option: SelectOption<Value>) => {
    setQuery('');
    onChange?.(option);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setQuery('');
    }
    onOpenChange?.(isOpen);
  };

  return (
    <CompactSelect
      {...compactSelectProps}
      searchable
      disableSearchFilter
      clearable={false}
      options={options}
      onSearch={handleSearch}
      onChange={handleChange}
      onOpenChange={handleOpenChange}
      loading={isPending}
      emptyMessage={isPending ? t('Loading...') : emptyMessage}
    />
  );
}
