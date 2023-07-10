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
  const location = useLocation();
  const eventView = getEventView(location, moduleName, spanCategory);

  const {data: operations} = useSpansQuery<[{'span.op': string}]>({
    eventView,
    initialData: [],
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

function getEventView(location: Location, moduleName: ModuleName, spanCategory?: string) {
  const queryConditions: string[] = [];
  if (moduleName) {
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
      fields: ['span.op', 'count()'],
      orderby: '-count',
      query: queryConditions.join(' '),
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
