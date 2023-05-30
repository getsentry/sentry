import {browserHistory} from 'react-router';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName} from 'sentry/views/starfish/types';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

type Props = {
  value: string;
  moduleName?: ModuleName;
};

export function SpanOperationSelector({value = '', moduleName = ModuleName.ALL}: Props) {
  // TODO: This only returns the top 25 operations. It should either load them all, or paginate, or allow searching
  //
  const location = useLocation();
  const query = getQuery(moduleName);
  const eventView = getEventView();

  const {data: operations} = useSpansQuery<[{'span.op': string}]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
  });

  const options = [
    {value: '', label: 'All'},
    ...operations.map(datum => ({
      value: datum['span.op'],
      label: datum['span.op'],
    })),
  ];

  return (
    <CompactSelect
      triggerProps={{prefix: t('Operation')}}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            span_operation: newValue.value,
          },
        });
      }}
    />
  );
}

function getQuery(moduleName: ModuleName) {
  return `SELECT span_operation as "span.op", count()
    FROM spans_experimental_starfish
    WHERE span_operation != ''
    ${moduleName !== ModuleName.ALL ? `AND module = '${moduleName}'` : ''}
    GROUP BY span_operation
    ORDER BY count() DESC
    LIMIT 25
  `;
}

function getEventView() {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['span.op', 'count()'],
    orderby: '-count',
    dataset: DiscoverDatasets.SPANS_METRICS,
    projects: [1],
    version: 2,
  });
}
