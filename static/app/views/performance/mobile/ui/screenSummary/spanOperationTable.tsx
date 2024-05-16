import * as qs from 'query-string';

import {getInterval} from 'sentry/components/charts/utils';
import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {APP_START_SPANS} from 'sentry/views/performance/mobile/appStarts/screenSummary/spanOpSelector';
import type {SpanOperationTableProps} from 'sentry/views/performance/mobile/components/samplesTables';
import {ScreensTable} from 'sentry/views/performance/mobile/components/screensTable';
import {MobileCursors} from 'sentry/views/performance/mobile/screenload/screens/constants';
import {useTableQuery} from 'sentry/views/performance/mobile/screenload/screens/screensTable';
import {Referrer} from 'sentry/views/performance/mobile/ui/referrers';
import {useMobileUIModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/starfish/components/releaseSelector';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';

const {SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} = SpanMetricsField;

const VALID_SPAN_OPS = APP_START_SPANS;

export function SpanOperationTable({
  transaction,
  primaryRelease,
  secondaryRelease,
}: SpanOperationTableProps) {
  const moduleURL = useMobileUIModuleURL();
  const location = useLocation();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query?.[MobileCursors.SPANS_TABLE]);

  const spanOp = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';
  const deviceClass = decodeScalar(location.query[SpanMetricsField.DEVICE_CLASS]) ?? '';

  // TODO: These filters seem to be too aggressive, check that they are ingesting properly
  const searchQuery = new MutableSearch([
    // 'has:span.description',
    // 'transaction.op:ui.load',
    `transaction:${transaction}`,
    `${SpanMetricsField.SPAN_OP}:${spanOp ? spanOp : `[${VALID_SPAN_OPS.join(',')}]`}`,
    ...(spanOp ? [`${SpanMetricsField.SPAN_OP}:${spanOp}`] : []),
    ...(deviceClass ? [`${SpanMetricsField.DEVICE_CLASS}:${deviceClass}`] : []),
  ]);
  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const orderby = decodeScalar(location.query.sort, '');

  const newQuery: NewQuery = {
    name: '',
    fields: [
      PROJECT_ID,
      SPAN_OP,
      SPAN_GROUP,
      SPAN_DESCRIPTION,
      `avg_if(mobile.slow_frames,release,${primaryRelease})`,
      `avg_if(mobile.slow_frames,release,${secondaryRelease})`,
      `avg_compare(mobile.slow_frames,release,${primaryRelease},${secondaryRelease})`,
      `avg_if(mobile.frozen_frames,release,${primaryRelease})`,
      `avg_if(mobile.frozen_frames,release,${secondaryRelease})`,
      `avg_compare(mobile.frozen_frames,release,${primaryRelease},${secondaryRelease})`,
      `avg_if(mobile.frames_delay,release,${primaryRelease})`,
      `avg_if(mobile.frames_delay,release,${secondaryRelease})`,
      `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
    ],
    query: queryStringPrimary,
    orderby,
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
    interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {data, isLoading, pageLinks} = useTableQuery({
    eventView,
    enabled: true,
    referrer: Referrer.SPAN_OPERATION_TABLE,
    cursor,
  });

  const columnNameMap = {
    [SPAN_OP]: t('Operation'),
    [SPAN_DESCRIPTION]: t('Span Description'),
    [`avg_if(mobile.slow_frames,release,${primaryRelease})`]: t(
      'Slow (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(mobile.slow_frames,release,${secondaryRelease})`]: t(
      'Slow (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
    [`avg_compare(mobile.slow_frames,release,${primaryRelease},${secondaryRelease})`]:
      t('Change'),
    [`avg_if(mobile.frozen_frames,release,${primaryRelease})`]: t(
      'Frozen (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(mobile.frozen_frames,release,${secondaryRelease})`]: t(
      'Frozen (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
    [`avg_compare(mobile.frozen_frames,release,${primaryRelease},${secondaryRelease})`]:
      t('Change'),
    [`avg_if(mobile.frames_delay,release,${primaryRelease})`]: t(
      'Delay (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(mobile.frames_delay,release,${secondaryRelease})`]: t(
      'Delay (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
    [`avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`]:
      t('Change'),
  };

  function renderBodyCell(column, row) {
    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanMetricsField.SPAN_DESCRIPTION];

      const pathname = `${moduleURL}/spans/`;
      const query = {
        ...location.query,
        transaction,
        spanOp: row[SpanMetricsField.SPAN_OP],
        spanGroup: row[SpanMetricsField.SPAN_GROUP],
        spanDescription: row[SpanMetricsField.SPAN_DESCRIPTION],
      };

      return (
        <Link to={`${pathname}?${qs.stringify(query)}`}>
          <OverflowEllipsisTextContainer>{label}</OverflowEllipsisTextContainer>
        </Link>
      );
    }

    if (column.key.startsWith('avg_if(mobile.frames_delay')) {
      return (
        <NumberContainer>
          {typeof row[column.key] === 'number' ? (
            <Duration seconds={row[column.key]} fixedDigits={2} abbreviation />
          ) : (
            '-'
          )}
        </NumberContainer>
      );
    }

    return null;
  }

  return (
    <ScreensTable
      columnNameMap={columnNameMap}
      data={data}
      eventView={eventView}
      isLoading={isLoading}
      pageLinks={pageLinks}
      columnOrder={[
        String(SPAN_OP),
        String(SPAN_DESCRIPTION),
        `avg_if(mobile.slow_frames,release,${primaryRelease})`,
        `avg_if(mobile.slow_frames,release,${secondaryRelease})`,
        `avg_compare(mobile.slow_frames,release,${primaryRelease},${secondaryRelease})`,
        `avg_if(mobile.frozen_frames,release,${primaryRelease})`,
        `avg_if(mobile.frozen_frames,release,${secondaryRelease})`,
        `avg_compare(mobile.frozen_frames,release,${primaryRelease},${secondaryRelease})`,
        `avg_if(mobile.frames_delay,release,${primaryRelease})`,
        `avg_if(mobile.frames_delay,release,${secondaryRelease})`,
        `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
      ]}
      defaultSort={[
        {
          key: `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
          order: 'desc',
        },
      ]}
      customBodyCellRenderer={renderBodyCell}
    />
  );
}
