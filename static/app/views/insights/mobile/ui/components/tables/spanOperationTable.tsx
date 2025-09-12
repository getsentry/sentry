import * as qs from 'query-string';

import {getInterval} from 'sentry/components/charts/utils';
import {Link} from 'sentry/components/core/link';
import Duration from 'sentry/components/duration';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {APP_START_SPANS} from 'sentry/views/insights/mobile/appStarts/components/spanOpSelector';
import type {SpanOperationTableProps} from 'sentry/views/insights/mobile/common/components/tables/samplesTables';
import {ScreensTable} from 'sentry/views/insights/mobile/common/components/tables/screensTable';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {Referrer} from 'sentry/views/insights/mobile/ui/referrers';
import {ModuleName, SpanFields, type SubregionCode} from 'sentry/views/insights/types';

const {SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} = SpanFields;

const VALID_SPAN_OPS = APP_START_SPANS;

export function SpanOperationTable({
  transaction,
  primaryRelease,
  secondaryRelease,
}: SpanOperationTableProps) {
  const moduleURL = useModuleURL('mobile-vitals');
  const location = useLocation();
  const {selection} = usePageFilters();
  const cursor = decodeScalar(location.query?.[MobileCursors.SPANS_TABLE]);

  const spanOp = decodeScalar(location.query[SpanFields.SPAN_OP]) ?? '';
  const deviceClass = decodeScalar(location.query[SpanFields.DEVICE_CLASS]) ?? '';
  const subregions = decodeList(
    location.query[SpanFields.USER_GEO_SUBREGION]
  ) as SubregionCode[];

  // TODO: These filters seem to be too aggressive, check that they are ingesting properly
  const searchQuery = new MutableSearch([
    // 'has:span.description',
    // 'transaction.op:ui.load',
    `transaction:${transaction}`,
    `${SpanFields.SPAN_OP}:${spanOp ? spanOp : `[${VALID_SPAN_OPS.join(',')}]`}`,
    ...(spanOp ? [`${SpanFields.SPAN_OP}:${spanOp}`] : []),
    ...(deviceClass ? [`${SpanFields.DEVICE_CLASS}:${deviceClass}`] : []),
    ...(subregions.length
      ? [`${SpanFields.USER_GEO_SUBREGION}:[${subregions.join(',')}]`]
      : []),
  ]);
  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  // Only show comparison when we have two different releases selected
  const primaryReleaseSelected = primaryRelease && primaryRelease !== '';
  const secondaryReleaseSelected = secondaryRelease && secondaryRelease !== '';
  const showComparison = primaryReleaseSelected && secondaryReleaseSelected;

  const orderby = decodeScalar(location.query.sort, '');

  const baseFields = [PROJECT_ID, SPAN_OP, SPAN_GROUP, SPAN_DESCRIPTION];
  let fields: any;

  if (showComparison) {
    fields = [
      ...baseFields,
      `division_if(mobile.slow_frames,mobile.total_frames,release,equals,${primaryRelease})`,
      `division_if(mobile.slow_frames,mobile.total_frames,release,equals,${secondaryRelease})`,
      `division_if(mobile.frozen_frames,mobile.total_frames,release,equals,${primaryRelease})`,
      `division_if(mobile.frozen_frames,mobile.total_frames,release,equals,${secondaryRelease})`,
      `avg_if(mobile.frames_delay,release,equals,${primaryRelease})`,
      `avg_if(mobile.frames_delay,release,equals,${secondaryRelease})`,
      `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
    ] as any;
  } else {
    fields = [
      ...baseFields,
      'division(mobile.slow_frames,mobile.total_frames)',
      'division(mobile.frozen_frames,mobile.total_frames)',
      'avg(mobile.frames_delay)',
    ] as any;
  }

  const newQuery: NewQuery = {
    name: '',
    fields,
    query: queryStringPrimary,
    orderby,
    dataset: DiscoverDatasets.SPANS,
    version: 2,
    projects: selection.projects,
    interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);

  const {data, meta, isPending, pageLinks} = useSpans(
    {
      cursor,
      search: queryStringPrimary,
      orderby,
      fields,
    },
    Referrer.SPAN_OPERATION_TABLE
  );

  const columnNameMap: Record<string, string> = {
    [SPAN_OP]: t('Operation'),
    [SPAN_DESCRIPTION]: t('Span Description'),
  };

  if (showComparison) {
    columnNameMap[
      `division_if(mobile.slow_frames,mobile.total_frames,release,equals,${primaryRelease})`
    ] = t('Slow (%s)', PRIMARY_RELEASE_ALIAS);
    columnNameMap[
      `division_if(mobile.slow_frames,mobile.total_frames,release,equals,${secondaryRelease})`
    ] = t('Slow (%s)', SECONDARY_RELEASE_ALIAS);
    columnNameMap[
      `division_if(mobile.frozen_frames,mobile.total_frames,release,equals,${primaryRelease})`
    ] = t('Frozen (%s)', PRIMARY_RELEASE_ALIAS);
    columnNameMap[
      `division_if(mobile.frozen_frames,mobile.total_frames,release,equals,${secondaryRelease})`
    ] = t('Frozen (%s)', SECONDARY_RELEASE_ALIAS);
    columnNameMap[`avg_if(mobile.frames_delay,release,equals,${primaryRelease})`] = t(
      'Delay (%s)',
      PRIMARY_RELEASE_ALIAS
    );
    columnNameMap[`avg_if(mobile.frames_delay,release,equals,${secondaryRelease})`] = t(
      'Delay (%s)',
      SECONDARY_RELEASE_ALIAS
    );
    columnNameMap[
      `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`
    ] = t('Change');
  } else {
    columnNameMap['division(mobile.slow_frames,mobile.total_frames)'] = t('Slow');
    columnNameMap['division(mobile.frozen_frames,mobile.total_frames)'] = t('Frozen');
    columnNameMap['avg(mobile.frames_delay)'] = t('Delay');
  }

  const columnTooltipMap: Record<string, string> = {};

  if (showComparison) {
    columnTooltipMap[
      `division_if(mobile.slow_frames,mobile.total_frames,release,equals,${primaryRelease})`
    ] = t(
      'The number of slow frames divided by total frames (%s)',
      PRIMARY_RELEASE_ALIAS
    );
    columnTooltipMap[
      `division_if(mobile.slow_frames,mobile.total_frames,release,equals,${secondaryRelease})`
    ] = t(
      'The number of slow frames divided by total frames (%s)',
      SECONDARY_RELEASE_ALIAS
    );
    columnTooltipMap[
      `division_if(mobile.frozen_frames,mobile.total_frames,release,equals,${primaryRelease})`
    ] = t(
      'The number of frozen frames divided by total frames (%s)',
      PRIMARY_RELEASE_ALIAS
    );
    columnTooltipMap[
      `division_if(mobile.frozen_frames,mobile.total_frames,release,equals,${secondaryRelease})`
    ] = t(
      'The number of frozen frames divided by total frames (%s)',
      SECONDARY_RELEASE_ALIAS
    );
  } else {
    columnTooltipMap['division(mobile.slow_frames,mobile.total_frames)'] = t(
      'The number of slow frames divided by total frames'
    );
    columnTooltipMap['division(mobile.frozen_frames,mobile.total_frames)'] = t(
      'The number of frozen frames divided by total frames'
    );
  }

  function renderBodyCell(column: any, row: any) {
    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanFields.SPAN_DESCRIPTION];
      const pathname = `${moduleURL}/details/`;

      const query = {
        ...location.query,
        transaction,
        spanOp: row[SpanFields.SPAN_OP],
        spanGroup: row[SpanFields.SPAN_GROUP],
        spanDescription: row[SpanFields.SPAN_DESCRIPTION],
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

  const columnOrder = showComparison
    ? [
        String(SPAN_OP),
        String(SPAN_DESCRIPTION),
        `division_if(mobile.slow_frames,mobile.total_frames,release,equals,${primaryRelease})`,
        `division_if(mobile.slow_frames,mobile.total_frames,release,equals,${secondaryRelease})`,
        `division_if(mobile.frozen_frames,mobile.total_frames,release,equals,${primaryRelease})`,
        `division_if(mobile.frozen_frames,mobile.total_frames,release,equals,${secondaryRelease})`,
        `avg_if(mobile.frames_delay,release,equals,${primaryRelease})`,
        `avg_if(mobile.frames_delay,release,equals,${secondaryRelease})`,
        `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
      ]
    : [
        String(SPAN_OP),
        String(SPAN_DESCRIPTION),
        'division(mobile.slow_frames,mobile.total_frames)',
        'division(mobile.frozen_frames,mobile.total_frames)',
        'avg(mobile.frames_delay)',
      ];

  const defaultSort = showComparison
    ? [
        {
          key: `avg_compare(mobile.frames_delay,release,${primaryRelease},${secondaryRelease})`,
          order: 'desc' as const,
        },
      ]
    : [
        {
          key: 'avg(mobile.frames_delay)',
          order: 'desc' as const,
        },
      ];

  return (
    <ScreensTable
      columnNameMap={columnNameMap}
      columnTooltipMap={columnTooltipMap}
      data={{data, meta: meta ?? {}}}
      eventView={eventView}
      isLoading={isPending}
      pageLinks={pageLinks}
      columnOrder={columnOrder}
      defaultSort={defaultSort}
      customBodyCellRenderer={renderBodyCell}
      moduleName={ModuleName.MOBILE_UI}
    />
  );
}
