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
import {STARTUP_SPANS} from 'sentry/views/starfish/views/appStartup/screenSummary/spanOperationTable';
import {MobileCursors} from 'sentry/views/starfish/views/screens/constants';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';

type Props = {
  primaryRelease?: string;
  secondaryRelease?: string;
  transaction?: string;
};

export function SpanOpSelector({transaction, primaryRelease, secondaryRelease}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();

  const value = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';

  const searchQuery = new MutableSearch([
    'transaction.op:ui.load',
    `transaction:${transaction}`,
    `span.op:[${[...STARTUP_SPANS].join(',')}]`,
    'has:span.description',
    '!span.description:"Cold Start"',
    '!span.description:"Warm Start"',
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
