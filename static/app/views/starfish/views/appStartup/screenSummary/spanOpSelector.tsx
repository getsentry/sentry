import {browserHistory} from 'react-router';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {COLD_START_TYPE} from 'sentry/views/starfish/views/appStartup/screenSummary/startTypeSelector';
import {MobileCursors} from 'sentry/views/starfish/views/screens/constants';
import {TTID_CONTRIBUTING_SPAN_OPS} from 'sentry/views/starfish/views/screens/screenLoadSpans/spanOpSelector';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

export const APP_START_SPANS = [
  ...TTID_CONTRIBUTING_SPAN_OPS,
  'app.start.cold',
  'app.start.warm',
  'contentprovider.load',
  'application.load',
  'activity.load',
];

type Props = {
  primaryRelease?: string;
  secondaryRelease?: string;
  transaction?: string;
};

export function SpanOpSelector({transaction, primaryRelease, secondaryRelease}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();

  const value = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';
  const appStartType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const searchQuery = new MutableSearch([
    // Exclude root level spans because they're comprised of nested operations
    '!span.description:"Cold Start"',
    '!span.description:"Warm Start"',
    // Exclude this span because we can get TTID contributing spans instead
    '!span.description:"Initial Frame Render"',
    'has:span.description',
    'transaction.op:ui.load',
    `transaction:${transaction}`,
    `has:ttid`,
    `span.op:[${APP_START_SPANS.join(',')}]`,
    `app_start_type:${appStartType}`,
  ]);
  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const newQuery: NewQuery = {
    name: '',
    fields: [SpanMetricsField.SPAN_OP, 'count()'],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  const {data} = useTableQuery({
    eventView,
    enabled: true,
    limit: 25,
    referrer: 'api.starfish.get-span-operations',
  });

  const options = [
    {value: '', label: t('All')},
    ...(data?.data ?? [])
      .filter(datum => Boolean(datum[SpanMetricsField.SPAN_OP]))
      .map(datum => {
        return {
          value: datum[SpanMetricsField.SPAN_OP],
          label: datum[SpanMetricsField.SPAN_OP],
        };
      }),
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
            [SpanMetricsField.SPAN_OP]: newValue.value,
            [MobileCursors.SPANS_TABLE]: undefined,
          },
        });
      }}
    />
  );
}
