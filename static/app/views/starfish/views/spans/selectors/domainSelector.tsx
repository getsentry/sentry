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
import {ModuleName, SpanMetricsFields} from 'sentry/views/starfish/types';
import {buildEventViewQuery} from 'sentry/views/starfish/utils/buildEventViewQuery';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {
  EMPTY_OPTION_VALUE,
  EmptyOption,
} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

const {SPAN_DOMAIN} = SpanMetricsFields;

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

  const {data: domains, isLoading} = useSpansQuery<{'span.domain': string}[]>({
    eventView,
    initialData: [],
    limit: LIMIT,
    referrer: 'api.starfish.get-span-domains',
  });

  // If the maximum number of domains is returned, we need to requery on input change to get full results
  if (!state.shouldRequeryOnInputChange && domains && domains.length >= LIMIT) {
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
        {
          value: EMPTY_OPTION_VALUE,
          label: <EmptyOption />,
        },
        ...(domains ?? [])
          .filter(datum => Boolean(datum[SPAN_DOMAIN]))
          .map(datum => {
            return {
              value: datum[SPAN_DOMAIN],
              label: datum[SPAN_DOMAIN],
            };
          })
          .sort((a, b) => a.value.localeCompare(b.value)),
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
            [SPAN_DOMAIN]: newValue.value,
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
  none: t('Domain'),
  Other: t('Domain'),
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
      location: {...location, query: omit(location.query, SPAN_DOMAIN)},
      spanCategory,
    }),
    ...(search && search.length > 0 ? [`span.domain:*${search}*`] : []),
  ].join(' ');
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: ['span.domain', 'count()'],
      orderby: '-count',
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
