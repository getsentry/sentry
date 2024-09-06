import type {ReactNode} from 'react';
import type {Location} from 'history';
import omit from 'lodash/omit';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EMPTY_OPTION_VALUE} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import {buildEventViewQuery} from 'sentry/views/insights/common/utils/buildEventViewQuery';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {EmptyContainer} from 'sentry/views/insights/common/views/spans/selectors/emptyOption';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_ACTION} = SpanMetricsField;

type Props = {
  moduleName: ModuleName;
  spanCategory?: string;
  value?: string;
};

export function ActionSelector({value = '', moduleName, spanCategory}: Props) {
  // TODO: This only returns the top 25 actions. It should either load them all, or paginate, or allow searching
  //
  const location = useLocation();
  const organization = useOrganization();
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
    <CompactSelect
      style={{maxWidth: '200px'}}
      triggerProps={{prefix: LABEL_FOR_MODULE_NAME[moduleName]}}
      options={options}
      value={value ?? ''}
      onChange={newValue => {
        trackAnalytics('insight.general.select_action_value', {
          organization,
          source: moduleName,
          value: newValue.value,
        });
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
  db: t('Command'),
  cache: t('Action'),
  vital: t('Action'),
  queue: t('Action'),
  screen_load: t('Action'),
  app_start: t('Action'),
  resource: t('Resource'),
  other: t('Action'),
  'mobile-ui': t('Action'),
  'mobile-screens': t('Action'),
  ai: 'Action',
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
