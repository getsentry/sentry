import {browserHistory} from 'react-router';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

type Props = {
  value: string;
};

export function SpanOperationSelector({value = ''}: Props) {
  // TODO: This only returns the top 25 operations. It should either load them all, or paginate, or allow searching
  //
  const location = useLocation();
  const query = getQuery();
  const eventView = getEventView();

  const {data: operations} = useSpansQuery<[{span_operation: string}]>({
    eventView,
    queryString: query,
    initialData: [],
    enabled: Boolean(query),
  });

  const options = [
    {value: '', label: 'All'},
    ...operations.map(({span_operation}) => ({
      value: span_operation,
      label: span_operation,
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

function getQuery() {
  return `SELECT span_operation, count()
    FROM spans_experimental_starfish
    WHERE span_operation != ''
    GROUP BY span_operation
    ORDER BY count() DESC
    LIMIT 25
  `;
}

function getEventView() {
  return EventView.fromSavedQuery({
    name: '',
    fields: ['span_operation', 'count()'],
    orderby: '-count',
    dataset: DiscoverDatasets.SPANS_INDEXED,
    projects: [1],
    version: 2,
  });
}
