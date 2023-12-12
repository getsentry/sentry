import {ReactNode, useCallback, useEffect, useRef, useState} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import debounce from 'lodash/debounce';
import flatten from 'lodash/flatten';
import omit from 'lodash/omit';
import uniq from 'lodash/uniq';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {buildEventViewQuery} from 'sentry/views/starfish/utils/buildEventViewQuery';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {
  EMPTY_OPTION_VALUE,
  EmptyContainer,
} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

type Props = {
  additionalQuery?: string[];
  emptyOptionLocation?: 'top' | 'bottom';
  moduleName?: ModuleName;
  spanCategory?: string;
  value?: string;
};

interface DomainData {
  'span.domain': string[];
}

interface DomainCacheValue {
  domains: Set<string>;
  initialLoadHadMoreData: boolean;
}

export function DomainSelector({
  value = '',
  moduleName = ModuleName.ALL,
  spanCategory,
  additionalQuery = [],
  emptyOptionLocation = 'bottom',
}: Props) {
  const location = useLocation();

  const [searchInputValue, setSearchInputValue] = useState<string>(''); // Realtime domain search value in UI
  const [domainQuery, setDomainQuery] = useState<string>(''); // Debounced copy of `searchInputValue` used for the Discover query

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce(newSearch => {
      setDomainQuery(newSearch);
    }, 500),
    []
  );

  const eventView = getEventView(
    location,
    moduleName,
    spanCategory,
    domainQuery,
    additionalQuery
  );

  const {
    data: domainData,
    isLoading,
    pageLinks,
  } = useSpansQuery<DomainData[]>({
    eventView,
    initialData: [],
    limit: LIMIT,
    referrer: 'api.starfish.get-span-domains',
  });

  const incomingDomains = uniq(
    flatten(domainData?.map(row => row[SpanMetricsField.SPAN_DOMAIN]))
  );

  // Cache for all previously seen domains
  const domainCache = useRef<DomainCacheValue>({
    domains: new Set(),
    initialLoadHadMoreData: true,
  });

  // The current selected table might not be in the cached set. Ensure it's always there
  if (value) {
    domainCache.current.domains.add(value);
  }

  // When caching the unfiltered domain data result, check if it had more data. If not, there's no point making any more requests when users update the search filter that narrows the search
  useEffect(() => {
    if (domainQuery === '' && !isLoading) {
      const {next} = parseLinkHeader(pageLinks ?? '');

      domainCache.current.initialLoadHadMoreData = next?.results ?? false;
    }
  }, [domainQuery, pageLinks, isLoading]);

  // Cache all known domains from previous requests
  useEffect(() => {
    incomingDomains?.forEach(domain => {
      domainCache.current.domains.add(domain);
    });
  }, [incomingDomains]);

  const emptyOption = {
    value: EMPTY_OPTION_VALUE,
    label: (
      <EmptyContainer>{t('(No %s)', LABEL_FOR_MODULE_NAME[moduleName])}</EmptyContainer>
    ),
  };

  const options = [
    {value: '', label: 'All'},
    ...(emptyOptionLocation === 'top' ? [emptyOption] : []),
    ...Array.from(domainCache.current.domains)
      .map(datum => {
        return {
          value: datum,
          label: datum,
        };
      })
      .sort((a, b) => a.value.localeCompare(b.value)),
    ...(emptyOptionLocation === 'bottom' ? [emptyOption] : []),
  ];

  return (
    <SelectControl
      inFieldLabel={`${LABEL_FOR_MODULE_NAME[moduleName]}:`}
      inputValue={searchInputValue}
      value={value}
      options={options}
      isLoading={isLoading}
      onInputChange={input => {
        setSearchInputValue(input);

        // If the initial query didn't fetch all the domains, update the search query and fire off a new query with the given search
        if (domainCache.current.initialLoadHadMoreData) {
          debouncedSetSearch(input);
        }
      }}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [SpanMetricsField.SPAN_DOMAIN]: newValue.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
      noOptionsMessage={() => t('No results')}
    />
  );
}

const LIMIT = 100;

const LABEL_FOR_MODULE_NAME: {[key in ModuleName]: ReactNode} = {
  http: t('Host'),
  db: t('Table'),
  resource: t('Resource'),
  other: t('Domain'),
  '': t('Domain'),
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
