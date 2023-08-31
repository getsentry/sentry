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
import {
  DefaultEmptyOption,
  EMPTY_OPTION_VALUE,
} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

const {SPAN_OP} = SpanMetricsField;

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

  const {data: operations} = useSpansQuery<{'span.op': string}[]>({
    eventView,
    initialData: [],
    referrer: 'api.starfish.get-span-operations',
  });

  const options = [
    {value: '', label: 'All'},
    ...(operations ?? [])
      .filter(datum => Boolean(datum))
      .map(datum => {
        if (datum[SPAN_OP] === '') {
          return {
            value: EMPTY_OPTION_VALUE,
            label: <DefaultEmptyOption />,
          };
        }
        return {
          value: datum[SPAN_OP],
          label: datum[SPAN_OP],
        };
      }),
  ];

  return (
    <SelectControl
      inFieldLabel={`${t('Operation')}:`}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [SPAN_OP]: newValue.value,
          },
        });
      }}
    />
  );
}

function getEventView(location: Location, moduleName: ModuleName, spanCategory?: string) {
  const query = buildEventViewQuery({
    moduleName,
    location: {...location, query: omit(location.query, SPAN_OP)},
    spanCategory,
  }).join(' ');
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: [SPAN_OP, 'count()'],
      orderby: '-count',
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
