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

export function DomainSelector({value = '', moduleName = ModuleName.ALL}: Props) {
  // TODO: This only returns the top 25 domains. It should either load them all, or paginate, or allow searching
  //
  const {selection} = usePageFilters();

  const location = useLocation();
  const query = getQuery(moduleName);
  const eventView = getEventView(moduleName, selection);

  const {data: domains} = useSpansQuery<[{'span.domain': string}]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
  });

  const options = [
    {value: '', label: 'All'},
    ...domains.map(datum => ({
      value: datum['span.domain'],
      label: datum['span.domain'],
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
            domain: newValue.value,
          },
        });
      }}
    />
  );
}

const LABEL_FOR_MODULE_NAME: {[key in ModuleName]: ReactNode} = {
  http: t('Host'),
  db: t('Table'),
  none: t('Domain'),
  '': t('Domain'),
};

function getQuery(moduleName?: string) {
  return `SELECT domain as "span.domain", count()
    FROM spans_experimental_starfish
    WHERE 1 = 1
    ${moduleName ? `AND module = '${moduleName}'` : ''}
    AND domain != ''
    GROUP BY domain
    ORDER BY count() DESC
    LIMIT 25
  `;
}

function getEventView(moduleName: string, pageFilters: PageFilters) {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['span.domain', 'count()'],
    orderby: '-count',
    query: moduleName ? `!span.domain:"" span.module:${moduleName}` : '!span.domain:""',
    dataset: DiscoverDatasets.SPANS_METRICS,
    start: pageFilters.datetime.start ?? undefined,
    end: pageFilters.datetime.end ?? undefined,
    range: pageFilters.datetime.period ?? undefined,
    projects: [1],
    version: 2,
  });
}
