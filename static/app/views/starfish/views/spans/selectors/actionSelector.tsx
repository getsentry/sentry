import {ReactNode} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {NULL_SPAN_CATEGORY} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

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

  const {data: actions} = useSpansQuery<[{'span.action': string}]>({
    eventView,
    initialData: [],
    enabled: !useHTTPActions,
  });

  const options = useHTTPActions
    ? HTTP_ACTION_OPTIONS
    : [
        {value: '', label: 'All'},
        ...actions.map(datum => ({
          value: datum['span.action'],
          label: datum['span.action'],
        })),
      ];

  return (
    <CompactSelect
      triggerProps={{
        prefix: LABEL_FOR_MODULE_NAME[moduleName],
      }}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            'span.action': newValue.value,
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
  none: t('Action'),
  '': t('Action'),
};

function getEventView(location: Location, moduleName: ModuleName, spanCategory?: string) {
  const queryConditions: string[] = [];
  queryConditions.push('has:span.description');

  if (moduleName) {
    queryConditions.push('has:span.action');
  }

  if (![ModuleName.ALL, ModuleName.NONE].includes(moduleName)) {
    queryConditions.push(`span.module:${moduleName}`);
  }

  if (moduleName === ModuleName.DB) {
    queryConditions.push('!span.op:db.redis');
  }

  if (spanCategory) {
    if (spanCategory === NULL_SPAN_CATEGORY) {
      queryConditions.push(`!has:span.category`);
    } else if (spanCategory !== 'Other') {
      queryConditions.push(`span.category:${spanCategory}`);
    }
  }
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: ['span.action', 'count()'],
      orderby: '-count',
      query: queryConditions.join(' '),
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
