import {useCallback, useEffect, useState} from 'react';
import debounce from 'lodash/debounce';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useResourcePagesQuery} from 'sentry/views/insights/browser/resources/queries/useResourcePagesQuery';
import {BrowserStarfishFields} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {useWasSearchSpaceExhausted} from 'sentry/views/insights/common/utils/useWasSearchSpaceExhausted';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';

export function TransactionSelector({
  value,
  defaultResourceTypes,
}: {
  defaultResourceTypes?: string[];
  value?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const pageFilters = usePageFilters();

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
    isPending,
    pageLinks,
  } = useResourcePagesQuery(defaultResourceTypes, searchQuery);

  if (value) {
    incomingPages.push(value);
  }

  const wasSearchSpaceExhausted = useWasSearchSpaceExhausted({
    query: searchQuery,
    isLoading: isPending,
    pageLinks,
  });

  const {options: transactionOptions, clear: clearTransactionOptionsCache} =
    useCompactSelectOptionsCache(
      incomingPages.filter(Boolean).map(page => ({value: page, label: page}))
    );

  useEffect(() => {
    clearTransactionOptionsCache();
  }, [pageFilters.selection.projects, clearTransactionOptionsCache]);

  const options = [{value: '', label: 'All'}, ...transactionOptions];

  return (
    <CompactSelect
      style={{maxWidth: '400px'}}
      value={value}
      options={options}
      emptyMessage={t('No results')}
      loading={isPending}
      searchable
      menuTitle={t('Page')}
      maxMenuWidth={'600px'}
      onSearch={newValue => {
        if (!wasSearchSpaceExhausted) {
          debouncedSetSearch(newValue);
        }
      }}
      triggerProps={{
        prefix: t('Page'),
      }}
      onChange={newValue => {
        trackAnalytics('insight.asset.filter_by_page', {
          organization,
        });
        navigate({
          ...location,
          query: {
            ...location.query,
            [BrowserStarfishFields.TRANSACTION]: newValue?.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
    />
  );
}
