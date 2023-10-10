import {ReactNode, useCallback, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {buildEventViewQuery} from 'sentry/views/starfish/utils/buildEventViewQuery';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {
  EMPTY_OPTION_VALUE,
  EmptyContainer,
} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

type Props = {
  moduleName?: ModuleName;
  spanCategory?: string;
  value?: string;
};

type State = {
  inputChanged: boolean;
  search: string;
  shouldRequeryOnInputChange: boolean;
};

const LIMIT = 100;

export function DomainSelector({
  value = '',
  moduleName = ModuleName.ALL,
  spanCategory,
}: Props) {
  const [state, setState] = useState<State>({
    search: '',
    inputChanged: false,
    shouldRequeryOnInputChange: false,
  });
  const location = useLocation();
  const eventView = getEventView(location, moduleName, spanCategory, state.search);

  const {data: domains, isLoading} = useSpansQuery<
    Array<{[SpanMetricsField.SPAN_DOMAIN]: Array<string>}>
  >({
    eventView,
    initialData: [],
    limit: LIMIT,
    referrer: 'api.starfish.get-span-domains',
  });

  const transformedDomains = Array.from(
    domains?.reduce((acc, curr) => {
      const spanDomainArray = curr[SpanMetricsField.SPAN_DOMAIN];
      if (spanDomainArray) {
        spanDomainArray.forEach(name => acc.add(name));
      }
      return acc;
    }, new Set<string>()) || []
  );

  // If the maximum number of domains is returned, we need to requery on input change to get full results
  if (
    !state.shouldRequeryOnInputChange &&
    transformedDomains &&
    transformedDomains.length >= LIMIT
  ) {
    setState({...state, shouldRequeryOnInputChange: true});
  }

  // Everytime loading is complete, reset the inputChanged state
  useEffect(() => {
    if (!isLoading && state.inputChanged) {
      setState({...state, inputChanged: false});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const optionsReady = !isLoading && !state.inputChanged;

  const options = optionsReady
    ? [
        {value: '', label: 'All'},
        ...transformedDomains
          .map(datum => {
            return {
              value: datum,
              label: datum,
            };
          })
          .sort((a, b) => a.value.localeCompare(b.value)),
        {
          value: EMPTY_OPTION_VALUE,
          label: (
            <EmptyContainer>
              {t('(No %s)', LABEL_FOR_MODULE_NAME[moduleName])}
            </EmptyContainer>
          ),
        },
      ]
    : [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceUpdateSearch = useCallback(
    debounce((search, currentState) => {
      setState({...currentState, search});
    }, 500),
    []
  );

  return (
    <SelectControl
      inFieldLabel={`${LABEL_FOR_MODULE_NAME[moduleName]}:`}
      value={value}
      options={options}
      onInputChange={input => {
        if (state.shouldRequeryOnInputChange) {
          setState({...state, inputChanged: true});
          debounceUpdateSearch(input, state);
        }
      }}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [SpanMetricsField.SPAN_DOMAIN]: newValue.value,
          },
        });
      }}
      noOptionsMessage={() => (optionsReady ? undefined : t('Loading...'))}
    />
  );
}

const LABEL_FOR_MODULE_NAME: {[key in ModuleName]: ReactNode} = {
  http: t('Host'),
  db: t('Table'),
  other: t('Domain'),
  '': t('Domain'),
};

function getEventView(
  location: Location,
  moduleName: ModuleName,
  spanCategory?: string,
  search?: string
) {
  const query = [
    ...buildEventViewQuery({
      moduleName,
      location: {
        ...location,
        query: omit(location.query, SpanMetricsField.SPAN_DOMAIN),
      },
      spanCategory,
    }),
    ...(search && search.length > 0
      ? [`${SpanMetricsField.SPAN_DOMAIN}:*${[search]}*`]
      : []),
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
