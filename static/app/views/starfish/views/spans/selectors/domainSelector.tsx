import {ReactNode} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import omit from 'lodash/omit';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName, SpanMetricsFields} from 'sentry/views/starfish/types';
import {buildEventViewQuery} from 'sentry/views/starfish/utils/buildEventViewQuery';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {
  NONE_OPTION_VALUE,
  NoneOption,
} from 'sentry/views/starfish/views/spans/selectors/noneOption';

const {SPAN_DOMAIN} = SpanMetricsFields;

type Props = {
  moduleName?: ModuleName;
  spanCategory?: string;
  value?: string;
};

export function DomainSelector({
  value = '',
  moduleName = ModuleName.ALL,
  spanCategory,
}: Props) {
  // TODO: This only returns the top 25 domains. It should either load them all, or paginate, or allow searching
  //
  const location = useLocation();
  const eventView = getEventView(location, moduleName, spanCategory);

  const {data: domains} = useSpansQuery<[{'span.domain': string}]>({
    eventView,
    initialData: [],
  });

  const options = [
    {value: '', label: 'All'},
    ...domains.map(datum => {
      if (datum[SPAN_DOMAIN] === '') {
        return {
          value: NONE_OPTION_VALUE,
          label: <NoneOption />,
        };
      }
      return {
        value: datum['span.domain'],
        label: datum['span.domain'],
      };
    }),
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
            'span.domain': newValue.value,
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

function getEventView(location: Location, moduleName: ModuleName, spanCategory?: string) {
  const query = buildEventViewQuery({
    moduleName,
    location: {...location, query: omit(location.query, SPAN_DOMAIN)},
    spanCategory,
  }).join(' ');
  return EventView.fromNewQueryWithLocation(
    {
      name: '',
      fields: ['span.domain', 'count()'],
      orderby: '-count',
      query,
      dataset: DiscoverDatasets.SPANS_METRICS,
      version: 2,
    },
    location
  );
}
