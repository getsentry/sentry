import {useCallback, useEffect, useState} from 'react';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniq} from 'sentry/utils/array/uniq';
import {EMPTY_OPTION_VALUE} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {buildEventViewQuery} from 'sentry/views/insights/common/utils/buildEventViewQuery';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {useWasSearchSpaceExhausted} from 'sentry/views/insights/common/utils/useWasSearchSpaceExhausted';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {EmptyContainer} from 'sentry/views/insights/common/views/spans/selectors/emptyOption';
import {type ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

type Props = {
  domainAlias: string;
  moduleName: ModuleName;
  additionalQuery?: string[];
  emptyOptionLocation?: 'top' | 'bottom';
  spanCategory?: string;
  value?: string;
};

export function DomainSelector({
  value = '',
  moduleName,
  spanCategory,
  additionalQuery = [],
  emptyOptionLocation = 'bottom',
  domainAlias,
}: Props) {
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

  const query = [
    ...buildEventViewQuery({
      moduleName,
      location: {
        ...location,
        query: omit(location.query, ['span.action', 'span.domain']),
      },
      spanCategory,
    }),
    ...(searchQuery && searchQuery.length > 0
      ? [`${SpanMetricsField.SPAN_DOMAIN}:*${[searchQuery]}*`]
      : []),
    ...(additionalQuery || []),
  ].join(' ');

  const {
    data: domainData,
    isPending,
    pageLinks,
  } = useSpanMetrics(
    {
      limit: LIMIT,
      search: query,
      sorts: [{field: 'count()', kind: 'desc'}],
      fields: [SpanMetricsField.SPAN_DOMAIN, 'count()'],
    },
    'api.starfish.get-span-domains'
  );

  const wasSearchSpaceExhausted = useWasSearchSpaceExhausted({
    query: searchQuery,
    isLoading: isPending,
    pageLinks,
  });

  const incomingDomains = [
    ...uniq(domainData?.flatMap(row => row[SpanMetricsField.SPAN_DOMAIN])),
  ];

  if (value) {
    incomingDomains.push(value);
  }

  const {options: domainOptions, clear: clearDomainOptionsCache} =
    useCompactSelectOptionsCache(
      incomingDomains
        .filter(Boolean)
        .filter(domain => domain !== EMPTY_OPTION_VALUE)
        .map(datum => {
          return {
            value: datum,
            label: datum,
          };
        })
    );

  useEffect(() => {
    clearDomainOptionsCache();
  }, [pageFilters.selection.projects, clearDomainOptionsCache]);

  useEffect(() => {
    if (additionalQuery.length > 0) {
      clearDomainOptionsCache();
    }
  }, [additionalQuery, clearDomainOptionsCache]);

  const emptyOption: SelectOption<string> = {
    value: EMPTY_OPTION_VALUE,
    label: <EmptyContainer>{t('(No %s)', domainAlias)}</EmptyContainer>,
    textValue: t('(No %s)', domainAlias),
  };

  const options: Array<SelectOption<string>> = [
    {value: '', label: 'All'},
    ...(emptyOptionLocation === 'top' ? [emptyOption] : []),
    ...domainOptions,
    ...(emptyOptionLocation === 'bottom' ? [emptyOption] : []),
  ];

  return (
    <CompactSelect
      style={{maxWidth: '300px'}}
      value={value}
      options={options}
      emptyMessage={t('No results')}
      loading={isPending}
      searchable
      menuTitle={domainAlias}
      maxMenuWidth={'500px'}
      data-test-id="domain-selector"
      onSearch={newValue => {
        if (!wasSearchSpaceExhausted) {
          debouncedSetSearch(newValue);
        }
      }}
      triggerProps={{
        prefix: domainAlias,
      }}
      onChange={newValue => {
        trackAnalytics('insight.general.select_domain_value', {
          organization,
          source: moduleName,
        });
        navigate({
          ...location,
          query: {
            ...location.query,
            [SpanMetricsField.SPAN_DOMAIN]: newValue.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
    />
  );
}

const LIMIT = 100;
