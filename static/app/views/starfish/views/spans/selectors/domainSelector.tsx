import {ReactNode} from 'react';
import {browserHistory} from 'react-router';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

type Props = {
  moduleName?: ModuleName;
  value?: string;
};

export function DomainSelector({value = '', moduleName = ModuleName.ALL}: Props) {
  // TODO: This only returns the top 25 domains. It should either load them all, or paginate, or allow searching
  //
  const location = useLocation();
  const query = getQuery(moduleName);
  const eventView = getEventView(moduleName);

  const {data: operations} = useSpansQuery<[{domain: string}]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
  });

  const options = [
    {value: '', label: 'All'},
    ...operations.map(({domain}) => ({
      value: domain,
      label: domain,
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
  return `SELECT domain, count()
    FROM spans_experimental_starfish
    WHERE 1 = 1
    ${moduleName ? `AND module = '${moduleName}'` : ''}
    AND domain != ''
    GROUP BY domain
    ORDER BY count() DESC
    LIMIT 25
  `;
}

function getEventView(moduleName?: string) {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['domain', 'count()'],
    orderby: '-count',
    query: moduleName ? `module:${moduleName}` : '',
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
}
