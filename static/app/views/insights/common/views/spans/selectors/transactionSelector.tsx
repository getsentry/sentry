import {useCallback, useState} from 'react';
import debounce from 'lodash/debounce';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import SelectControlWithProps from 'sentry/views/insights/browser/resources/components/selectControlWithProps';
import {useResourcePagesQuery} from 'sentry/views/insights/browser/resources/queries/useResourcePagesQuery';
import {BrowserStarfishFields} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {setMerge, useArrayCache} from 'sentry/views/insights/common/utils/useArrayCache';
import {useWasSearchSpaceExhausted} from 'sentry/views/insights/common/utils/useWasSearchSpaceExhausted';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';

type Option = {
  label: string | React.ReactElement;
  value: string;
};

export function TransactionSelector({
  value,
  defaultResourceTypes,
}: {
  defaultResourceTypes?: string[];
  value?: string;
}) {
  const location = useLocation();
  const organization = useOrganization();

  const [searchInputValue, setSearchInputValue] = useState<string>(''); // Realtime domain search value in UI
  const [searchQuery, setSearchQuery] = useState<string>(''); // Debounced copy of `searchInputValue` used for the Discover query

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce(newSearch => {
      setSearchQuery(newSearch);
    }, 500),
    []
  );

  const {
    data: incomingPages,
    isLoading,
    pageLinks,
  } = useResourcePagesQuery(defaultResourceTypes, searchQuery);

  const wasSearchSpaceExhausted = useWasSearchSpaceExhausted({
    query: searchQuery,
    isLoading,
    pageLinks,
  });

  const pages = useArrayCache({
    items: incomingPages,
    sortFn: items => {
      return [...items].sort((a, b) => a.localeCompare(b));
    },
    mergeFn: setMerge,
  });

  const options: Option[] = [
    {value: '', label: 'All'},
    ...pages.map(page => ({value: page, label: page})),
  ];

  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Page')}:`}
      inputValue={searchInputValue}
      value={value}
      options={options}
      isLoading={isLoading}
      onInputChange={input => {
        setSearchInputValue(input);

        if (!wasSearchSpaceExhausted) {
          debouncedSetSearch(input);
        }
      }}
      onChange={newValue => {
        trackAnalytics('insight.asset.filter_by_page', {
          organization,
        });
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [BrowserStarfishFields.TRANSACTION]: newValue?.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
      noOptionsMessage={() => t('No results')}
    />
  );
}
