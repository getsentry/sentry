import {ReactNode} from 'react';
import {browserHistory} from 'react-router';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {PageFilters} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ModuleName} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

type Props = {
  moduleName?: ModuleName;
  value?: string;
};

export function ActionSelector({value = '', moduleName = ModuleName.ALL}: Props) {
  // TODO: This only returns the top 25 actions. It should either load them all, or paginate, or allow searching
  //
  const {selection} = usePageFilters();

  const location = useLocation();
  const query = getQuery(moduleName);
  const eventView = getEventView(moduleName, selection);

  const useHTTPActions = moduleName === ModuleName.HTTP;

  const {data: actions} = useSpansQuery<[{'span.action': string}]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query && !useHTTPActions),
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
            action: newValue.value,
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

function getQuery(moduleName?: string) {
  return `SELECT action as "span.action", count()
    FROM spans_experimental_starfish
    WHERE 1 = 1
    ${moduleName ? `AND module = '${moduleName}'` : ''}
    AND action != ''
    GROUP BY action
    ORDER BY count() DESC
    LIMIT 25
  `;
}

function getEventView(moduleName: ModuleName, pageFilters: PageFilters) {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['span.action', 'count()'],
    orderby: '-count',
    query: moduleName ? `!span.action:"" span.module:${moduleName}` : '!span.action:""',
    dataset: DiscoverDatasets.SPANS_METRICS,
    start: pageFilters.datetime.start ?? undefined,
    end: pageFilters.datetime.end ?? undefined,
    range: pageFilters.datetime.period ?? undefined,
    projects: [1],
    version: 2,
  });
}
