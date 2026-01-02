import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import * as qs from 'query-string';

import {Link} from 'sentry/components/core/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import useQueryBasedColumnResize from 'sentry/components/tables/gridEditable/useQueryBasedColumnResize';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {decodeList, decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {PercentChangeCell} from 'sentry/views/insights/common/components/tableCells/percentChangeCell';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {APP_START_SPANS} from 'sentry/views/insights/mobile/appStarts/components/spanOpSelector';
import {
  COLD_START_TYPE,
  WARM_START_TYPE,
} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {ModuleName, SpanFields, type SubregionCode} from 'sentry/views/insights/types';
import type {SpanProperty} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} = SpanFields;

type Props = {
  primaryRelease?: string;
  transaction?: string;
};

export function SpanOperationTable({transaction, primaryRelease}: Props) {
  const organization = useOrganization();
  const moduleURL = useModuleURL(ModuleName.MOBILE_VITALS);
  const baseURL = `${moduleURL}/details/`;

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  const cursor = decodeScalar(location.query?.[MobileCursors.SPANS_TABLE]);

  const spanOp = decodeScalar(location.query[SpanFields.SPAN_OP]) ?? '';
  const subregions = decodeList(
    location.query[SpanFields.USER_GEO_SUBREGION]
  ) as SubregionCode[];
  const startType =
    decodeScalar(location.query[SpanFields.APP_START_TYPE]) ?? COLD_START_TYPE;
  const deviceClass = decodeScalar(location.query[SpanFields.DEVICE_CLASS]) ?? '';

  const searchQuery = new MutableSearch([
    // Exclude root level spans because they're comprised of nested operations
    '!span.description:"Cold Start"',
    '!span.description:"Warm Start"',
    '!span.description:"Cold App Start"',
    '!span.description:"Warm App Start"',
    // Exclude this span because we can get TTID contributing spans instead
    '!span.description:"Initial Frame Render"',
    'has:span.description',
    'transaction.op:[ui.load,navigation]',
    `transaction:${transaction}`,
    'has:ttid',
    `${SpanFields.APP_START_TYPE}:${
      startType || `[${COLD_START_TYPE},${WARM_START_TYPE}]`
    }`,
    `${SpanFields.SPAN_OP}:${spanOp ? spanOp : `[${APP_START_SPANS.join(',')}]`}`,
    ...(spanOp ? [`${SpanFields.SPAN_OP}:${spanOp}`] : []),
    ...(deviceClass ? [`${SpanFields.DEVICE_CLASS}:${deviceClass}`] : []),
    ...(subregions.length > 0
      ? [`${SpanFields.USER_GEO_SUBREGION}:[${subregions.join(',')}]`]
      : []),
  ]);

  if (isProjectCrossPlatform) {
    searchQuery.addFilterValue('os.name', selectedPlatform);
  }

  const queryStringPrimary = appendReleaseFilters(searchQuery, primaryRelease);

  // Only show comparison when we have two different releases selected
  const baseFields: SpanProperty[] = [PROJECT_ID, SPAN_OP, SPAN_GROUP, SPAN_DESCRIPTION];
  const spanFields: SpanProperty[] = [`avg(${SPAN_SELF_TIME})`];

  const sort = decodeSorts(location.query[QueryParameterNames.SPANS_SORT])[0] ?? {
    kind: 'desc',
    field: `avg(${SPAN_SELF_TIME})`,
  };

  const {data, meta, isPending, pageLinks} = useSpans(
    {
      cursor,
      fields: baseFields.concat(spanFields),
      sorts: [sort],
      search: queryStringPrimary,
    },
    'api.insights.mobile-spartup-span-table'
  );

  const columnHeaders: GridColumnHeader[] = [
    {key: SPAN_OP, name: t('Operation'), width: COL_WIDTH_UNDEFINED},
    {key: SPAN_DESCRIPTION, name: t('Span Description'), width: COL_WIDTH_UNDEFINED},
    {
      key: `avg(${SPAN_SELF_TIME})`,
      name: t('Avg Duration'),
      width: COL_WIDTH_UNDEFINED,
    },
  ];

  function renderBodyCell(column: any, row: any): React.ReactNode {
    if (!meta?.fields) {
      return row[column.key];
    }

    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanFields.SPAN_DESCRIPTION];

      const query = {
        ...location.query,
        transaction,
        spanOp: row[SpanFields.SPAN_OP],
        spanGroup: row[SpanFields.SPAN_GROUP],
        spanDescription: row[SpanFields.SPAN_DESCRIPTION],
        appStartType: row[SpanFields.APP_START_TYPE],
      };

      return (
        <OverflowEllipsisTextContainer>
          <Link to={`${baseURL}?${qs.stringify(query)}`}>{label}</Link>
        </OverflowEllipsisTextContainer>
      );
    }

    if (meta.fields[column.key] === 'percent_change') {
      return (
        <PercentChangeCell
          deltaValue={defined(row[column.key]) ? parseFloat(row[column.key]) : Infinity}
          preferredPolarity="-"
        />
      );
    }

    const renderer = getFieldRenderer(column.key, meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: meta.units?.[column.key],
      theme,
    });
    return rendered;
  }

  function renderHeadCell(
    column: GridColumnHeader,
    tableMeta?: MetaType
  ): React.ReactNode {
    const fieldType = tableMeta?.fields?.[column.key];

    const alignment = fieldAlignment(column.key as string, fieldType);
    const field = {
      field: column.key as string,
      width: column.width,
    };

    function generateSortLink() {
      if (!tableMeta) {
        return undefined;
      }

      let newSortDirection: Sort['kind'] = 'desc';
      if (sort?.field === column.key) {
        if (sort.kind === 'desc') {
          newSortDirection = 'asc';
        }
      }

      function getNewSort() {
        return `${newSortDirection === 'desc' ? '-' : ''}${column.key}`;
      }

      return {
        ...location,
        query: {...location.query, [QueryParameterNames.SPANS_SORT]: getNewSort()},
      };
    }

    const canSort = isFieldSortable(field, tableMeta?.fields, true);

    const sortLink = (
      <SortLink
        align={alignment}
        title={column.name}
        direction={sort?.field === column.key ? sort.kind : undefined}
        canSort={canSort}
        generateSortLink={generateSortLink}
      />
    );
    return sortLink;
  }

  const handleCursor: CursorHandler = (newCursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [MobileCursors.SPANS_TABLE]: newCursor},
    });
  };

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: columnHeaders,
  });

  return (
    <Fragment>
      <GridEditable
        isLoading={isPending}
        data={data}
        columnOrder={columns}
        columnSortBy={[
          {
            key: sort.field,
            order: sort.kind,
          },
        ]}
        grid={{
          renderHeadCell: column => renderHeadCell(column, meta),
          renderBodyCell,
          onResizeColumn: handleResizeColumn,
        }}
      />
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}
