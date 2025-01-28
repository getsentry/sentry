import * as qs from 'query-string';

import {getInterval} from 'sentry/components/charts/utils';
import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {APP_START_SPANS} from 'sentry/views/insights/mobile/appStarts/components/spanOpSelector';
import type {SpanOperationTableProps} from 'sentry/views/insights/mobile/common/components/tables/samplesTables';
import {ScreensTable} from 'sentry/views/insights/mobile/common/components/tables/screensTable';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {SUMMARY_PAGE_BASE_URL} from 'sentry/views/insights/mobile/screenRendering/settings';
import {Referrer} from 'sentry/views/insights/mobile/ui/referrers';
import {isModuleEnabled} from 'sentry/views/insights/pages/utils';
import {
  ModuleName,
  SpanMetricsField,
  type SubregionCode,
} from 'sentry/views/insights/types';

const {SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} = SpanMetricsField;

const VALID_SPAN_OPS = APP_START_SPANS;

export function SpanOperationTable({
  transaction,
  primaryRelease,
  secondaryRelease,
}: SpanOperationTableProps) {
  const moduleURL = useModuleURL('mobile-ui');
  const screenRenderingModuleUrl = useModuleURL(ModuleName.SCREEN_RENDERING);
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query?.[MobileCursors.SPANS_TABLE]);

  const spanOp = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';
  const deviceClass = decodeScalar(location.query[SpanMetricsField.DEVICE_CLASS]) ?? '';
  const subregions = decodeList(
    location.query[SpanMetricsField.USER_GEO_SUBREGION]
  ) as SubregionCode[];

  const isMobileScreensEnabled = isModuleEnabled(ModuleName.MOBILE_SCREENS, organization);

  // TODO: These filters seem to be too aggressive, check that they are ingesting properly
  const searchQuery = new MutableSearch([
    // 'has:span.description',
    // 'transaction.op:ui.load',
    `transaction:${transaction}`,
    `${SpanMetricsField.SPAN_OP}:${spanOp ? spanOp : `[${VALID_SPAN_OPS.join(',')}]`}`,
    ...(spanOp ? [`${SpanMetricsField.SPAN_OP}:${spanOp}`] : []),
    ...(deviceClass ? [`${SpanMetricsField.DEVICE_CLASS}:${deviceClass}`] : []),
    ...(subregions.length
      ? [`${SpanMetricsField.USER_GEO_SUBREGION}:[${subregions.join(',')}]`]
      : []),
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
      `division_if(mobile.slow_frames,mobile.total_frames,release,${primaryRelease})`,
      `division_if(mobile.slow_frames,mobile.total_frames,release,${secondaryRelease})`,
      `division_if(mobile.frozen_frames,mobile.total_frames,release,${primaryRelease})`,
      `division_if(mobile.frozen_frames,mobile.total_frames,release,${secondaryRelease})`,
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

  const {data, isPending, pageLinks} = useTableQuery({
    eventView,
    enabled: true,
    referrer: Referrer.SPAN_OPERATION_TABLE,
    cursor,
  });

  const columnNameMap = {
    [SPAN_OP]: t('Operation'),
    [SPAN_DESCRIPTION]: t('Span Description'),
    [`division_if(mobile.slow_frames,mobile.total_frames,release,${primaryRelease})`]: t(
      'Slow (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`division_if(mobile.slow_frames,mobile.total_frames,release,${secondaryRelease})`]:
      t('Slow (%s)', SECONDARY_RELEASE_ALIAS),
    [`division_if(mobile.frozen_frames,mobile.total_frames,release,${primaryRelease})`]:
      t('Frozen (%s)', PRIMARY_RELEASE_ALIAS),
    [`division_if(mobile.frozen_frames,mobile.total_frames,release,${secondaryRelease})`]:
      t('Frozen (%s)', SECONDARY_RELEASE_ALIAS),
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

  const columnTooltipMap = {
    [`division_if(mobile.slow_frames,mobile.total_frames,release,${primaryRelease})`]: t(
      'The number of slow frames divided by total frames (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`division_if(mobile.slow_frames,mobile.total_frames,release,${secondaryRelease})`]:
      t(
        'The number of slow frames divided by total frames (%s)',
        SECONDARY_RELEASE_ALIAS
      ),
    [`division_if(mobile.frozen_frames,mobile.total_frames,release,${primaryRelease})`]:
      t(
        'The number of frozen frames divided by total frames (%s)',
        PRIMARY_RELEASE_ALIAS
      ),
    [`division_if(mobile.frozen_frames,mobile.total_frames,release,${secondaryRelease})`]:
      t(
        'The number of frozen frames divided by total frames (%s)',
        SECONDARY_RELEASE_ALIAS
      ),
  };

  function renderBodyCell(column: any, row: any) {
    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanMetricsField.SPAN_DESCRIPTION];

      const pathname = isMobileScreensEnabled
        ? `${moduleURL}/spans/`
        : `${screenRenderingModuleUrl}/${SUMMARY_PAGE_BASE_URL}/`;

      const query = {
        ...location.query,
        transaction,
        spanOp: row[SpanMetricsField.SPAN_OP],
        spanGroup: row[SpanMetricsField.SPAN_GROUP],
        spanDescription: row[SpanMetricsField.SPAN_DESCRIPTION],
      };

      return (
        <OverflowEllipsisTextContainer>
          <Link to={`${pathname}?${qs.stringify(query)}`}>
            <OverflowEllipsisTextContainer>{label}</OverflowEllipsisTextContainer>
          </Link>
        </OverflowEllipsisTextContainer>
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
      columnTooltipMap={columnTooltipMap}
      data={data}
      eventView={eventView}
      isLoading={isPending}
      pageLinks={pageLinks}
      columnOrder={[
        String(SPAN_OP),
        String(SPAN_DESCRIPTION),
        `division_if(mobile.slow_frames,mobile.total_frames,release,${primaryRelease})`,
        `division_if(mobile.slow_frames,mobile.total_frames,release,${secondaryRelease})`,
        `division_if(mobile.frozen_frames,mobile.total_frames,release,${primaryRelease})`,
        `division_if(mobile.frozen_frames,mobile.total_frames,release,${secondaryRelease})`,
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
      moduleName={ModuleName.MOBILE_UI}
    />
  );
}
