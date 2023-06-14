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
import {NULL_SPAN_CATEGORY} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

type Props = {
  value: string;
  moduleName?: ModuleName;
  spanCategory?: string;
};

export function SpanOperationSelector({
  value = '',
  moduleName = ModuleName.ALL,
  spanCategory,
}: Props) {
  // TODO: This only returns the top 25 operations. It should either load them all, or paginate, or allow searching
  //
  const {selection} = usePageFilters();

  const location = useLocation();
  const query = getQuery(moduleName);
  const eventView = getEventView(moduleName, selection, spanCategory);

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
            'span.op': newValue.value,
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

function getEventView(
  moduleName: ModuleName,
  pageFilters: PageFilters,
  spanCategory?: string
) {
  const queryConditions: string[] = [];
  if (moduleName) {
    queryConditions.push(`span.module:${moduleName}`);
  }
  if (spanCategory) {
    if (spanCategory === NULL_SPAN_CATEGORY) {
      queryConditions.push(`!has:span.category`);
    } else if (spanCategory !== 'Other') {
      queryConditions.push(`span.category:${spanCategory}`);
    }
  }
  return EventView.fromSavedQuery({
    name: '',
    fields: ['span.op', 'count()'],
    orderby: '-count',
    query: queryConditions.join(' '),
    start: pageFilters.datetime.start ?? undefined,
    end: pageFilters.datetime.end ?? undefined,
    range: pageFilters.datetime.period ?? undefined,
    dataset: DiscoverDatasets.SPANS_METRICS,
    projects: [1],
    version: 2,
  });
}
