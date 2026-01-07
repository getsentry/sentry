import {useCallback, useState} from 'react';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {EMPTY_OPTION_VALUE} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {buildEventViewQuery} from 'sentry/views/insights/common/utils/buildEventViewQuery';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {useWasSearchSpaceExhausted} from 'sentry/views/insights/common/utils/useWasSearchSpaceExhausted';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {EmptyContainer} from 'sentry/views/insights/common/views/spans/selectors/emptyOption';
import {SpanFields, type ModuleName} from 'sentry/views/insights/types';

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
      ? [`${SpanFields.SPAN_DOMAIN}:*${[searchQuery]}*`]
      : []),
    ...(additionalQuery || []),
  ].join(' ');

  const {
    data: domainData,
    isPending,
    pageLinks,
  } = useSpans(
    {
      limit: LIMIT,
      search: query,
      sorts: [{field: 'count()', kind: 'desc'}],
      fields: [SpanFields.SPAN_DOMAIN, 'count()'],
    },
    'api.insights.get-span-domains'
  );

  const wasSearchSpaceExhausted = useWasSearchSpaceExhausted({
    query: searchQuery,
    isLoading: isPending,
    pageLinks,
  });

  const domainList: Array<{label: string; value: string}> = [];
  const uniqueDomains = new Set<string>();

  domainData.forEach(row => {
    const spanDomain: string | string[] = row[SpanFields.SPAN_DOMAIN];

    const domains = typeof spanDomain === 'string' ? spanDomain.split(',') : spanDomain;

    if (!domains || domains.length === 0) {
      return;
    }

    // if there is only one domain, this means that the domain is not a comma-separated list
    if (domains.length === 1 && domains?.[0]) {
      if (uniqueDomains.has(domains[0])) {
        return;
      }
      uniqueDomains.add(domains[0]);
      domainList.push({
        label: domains[0],
        value: `*${domains[0]}*`,
      });
    } else {
      domains?.forEach(domain => {
        if (uniqueDomains.has(domain) || !domain) {
          return;
        }
        uniqueDomains.add(domain);
        domainList.push({
          label: domain,
          value: `*,${domain},*`,
        });
      });
    }
  });

  if (value) {
    let scrubbedValue = value;
    if (scrubbedValue.startsWith('*') && scrubbedValue.endsWith('*')) {
      scrubbedValue = scrubbedValue.slice(1, -1);
    }
    if (scrubbedValue.startsWith(',') && scrubbedValue.endsWith(',')) {
      scrubbedValue = scrubbedValue.slice(1, -1);
    }
    domainList.push({
      label: scrubbedValue,
      value,
    });
  }

  const projectIds = [...pageFilters.selection.projects].sort();
  const cacheKey = [...additionalQuery, ...projectIds].join(' ');

  const {options: domainOptions} = useCompactSelectOptionsCache(
    domainList
      .filter(domain => Boolean(domain?.label))
      .filter(domain => domain.value !== EMPTY_OPTION_VALUE),
    cacheKey
  );

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
      data-test-id="domain-selector"
      onSearch={newValue => {
        if (!wasSearchSpaceExhausted) {
          debouncedSetSearch(newValue);
        }
      }}
      trigger={triggerProps => (
        <SelectTrigger.Button {...triggerProps} prefix={domainAlias} />
      )}
      onChange={newValue => {
        trackAnalytics('insight.general.select_domain_value', {
          organization,
          source: moduleName,
        });
        navigate({
          ...location,
          query: {
            ...location.query,
            [SpanFields.SPAN_DOMAIN]: newValue.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
    />
  );
}

const LIMIT = 100;
