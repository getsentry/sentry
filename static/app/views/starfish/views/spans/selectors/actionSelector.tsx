import {ReactNode} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import omit from 'lodash/omit';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {buildEventViewQuery} from 'sentry/views/starfish/utils/buildEventViewQuery';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {
  EMPTY_OPTION_VALUE,
  EmptyContainer,
} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

const {SPAN_ACTION} = SpanMetricsField;

type Props = {
  moduleName?: ModuleName;
  spanCategory?: string;
  value?: string;
};

export function ActionSelector({
  value = '',
  moduleName = ModuleName.ALL,
  spanCategory,
}: Props) {
  // TODO: This only returns the top 25 actions. It should either load them all, or paginate, or allow searching
  //
  const location = useLocation();
  const eventView = getEventView(location, moduleName, spanCategory);

  const useHTTPActions = moduleName === ModuleName.HTTP;

  const {data: actions} = useSpansQuery<{'span.action': string}[]>({
    eventView,
    initialData: [],
    enabled: !useHTTPActions,
    referrer: 'api.starfish.get-span-actions',
  });

  const options = useHTTPActions
    ? HTTP_ACTION_OPTIONS
    : [
        {value: '', label: 'All'},
        ...(actions ?? [])
          .filter(datum => Boolean(datum[SPAN_ACTION]))
          .map(datum => {
            return {
              value: datum[SPAN_ACTION],
              label: datum[SPAN_ACTION],
            };
          }),
        {
          value: EMPTY_OPTION_VALUE,
          label: (
            <EmptyContainer>
              {t('(No Detected %s)', LABEL_FOR_MODULE_NAME[moduleName])}
            </EmptyContainer>
          ),
        },
      ];

  return (
    <SelectControl
      inFieldLabel={`${LABEL_FOR_MODULE_NAME[moduleName]}:`}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [SPAN_ACTION]: newValue.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
    />
  );
}

const HTTP_ACTION_OPTIONS = [
  {value: '', label: 'All'},
  ...['GET', 'POST', 'PUT', 'DELETE'].map(action => ({
    value: action,
    label: action,
  })),
];

const LABEL_FOR_MODULE_NAME: {[key in ModuleName]: ReactNode} = {
  http: t('HTTP Method'),
  db: t('SQL Command'),
  resource: t('Resource'),
  other: t('Action'),
  '': t('Action'),
};

function getEventView(location: Location, moduleName: ModuleName, spanCategory?: string) {
  const query = buildEventViewQuery({
    moduleName,
    location: {...location, query: omit(location.query, ['span.action', 'span.domain'])},
    spanCategory,
  }).join(' ');
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: [SPAN_ACTION, 'count()'],
      orderby: '-count',
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
