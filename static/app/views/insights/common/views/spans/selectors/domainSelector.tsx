import type {ReactNode} from 'react';
import {useCallback, useEffect, useState} from 'react';
import type {Location} from 'history';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {uniq} from 'sentry/utils/array/uniq';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EMPTY_OPTION_VALUE} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import {buildEventViewQuery} from 'sentry/views/insights/common/utils/buildEventViewQuery';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {useWasSearchSpaceExhausted} from 'sentry/views/insights/common/utils/useWasSearchSpaceExhausted';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {EmptyContainer} from 'sentry/views/insights/common/views/spans/selectors/emptyOption';
import {type ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

type Props = {
  moduleName: ModuleName;
  additionalQuery?: string[];
  // Optional prop to override the default name of the selector label
  domainAlias?: string;
  emptyOptionLocation?: 'top' | 'bottom';
  spanCategory?: string;
  value?: string;
};

interface DomainData {
  'span.domain': string[];
}

export function DomainSelector({
  value = '',
  moduleName,
  spanCategory,
  additionalQuery = [],
  emptyOptionLocation = 'bottom',
  domainAlias,
}: Props) {
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

  const eventView = getEventView(
    location,
    moduleName,
    spanCategory,
    searchQuery,
    additionalQuery
  );

  const {
    data: domainData,
    isPending,
    pageLinks,
  } = useSpansQuery<DomainData[]>({
    eventView,
    initialData: [],
    limit: LIMIT,
    referrer: 'api.starfish.get-span-domains',
  });

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
    label: (
      <EmptyContainer>
        {t('(No %s)', domainAlias ?? LABEL_FOR_MODULE_NAME[moduleName])}
      </EmptyContainer>
    ),
    textValue: t('(No %s)', domainAlias ?? LABEL_FOR_MODULE_NAME[moduleName]),
  };

  const options: SelectOption<string>[] = [
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
      menuTitle={domainAlias ?? LABEL_FOR_MODULE_NAME[moduleName]}
      maxMenuWidth={'500px'}
      data-test-id="domain-selector"
      onSearch={newValue => {
        if (!wasSearchSpaceExhausted) {
          debouncedSetSearch(newValue);
        }
      }}
      triggerProps={{
        prefix: domainAlias ?? LABEL_FOR_MODULE_NAME[moduleName],
      }}
      onChange={newValue => {
        trackAnalytics('insight.general.select_domain_value', {
          organization,
          source: moduleName,
        });
        browserHistory.push({
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

const LABEL_FOR_MODULE_NAME: {[key in ModuleName]: ReactNode} = {
  http: t('Host'),
  db: t('Table'),
  cache: t('Domain'),
  vital: t('Domain'),
  queue: t('Domain'),
  screen_load: t('Domain'),
  app_start: t('Domain'),
  resource: t('Resource'),
  other: t('Domain'),
  ai: t('Domain'),
  crons: t('Domain'),
  uptime: t('Domain'),
  'screen-rendering': t('Domain'),
  'mobile-ui': t('Domain'),
  'mobile-screens': t('Domain'),
};

function getEventView(
  location: Location,
  moduleName: ModuleName,
  spanCategory?: string,
  search?: string,
  additionalQuery?: string[]
) {
  const query = [
    ...buildEventViewQuery({
      moduleName,
      location: {
        ...location,
        query: omit(location.query, ['span.action', 'span.domain']),
      },
      spanCategory,
    }),
    ...(search && search.length > 0
      ? [`${SpanMetricsField.SPAN_DOMAIN}:*${[search]}*`]
      : []),
    ...(additionalQuery || []),
  ].join(' ');
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: [SpanMetricsField.SPAN_DOMAIN, 'count()'],
      orderby: '-count',
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
