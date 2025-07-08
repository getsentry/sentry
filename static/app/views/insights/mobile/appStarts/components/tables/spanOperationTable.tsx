import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import * as qs from 'query-string';

import {Link} from 'sentry/components/core/link';
import type {CursorHandler} from 'sentry/components/pagination';
import Pagination from 'sentry/components/pagination';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
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
import {
  PRIMARY_RELEASE_ALIAS,
  SECONDARY_RELEASE_ALIAS,
} from 'sentry/views/insights/common/components/releaseSelector';
import {PercentChangeCell} from 'sentry/views/insights/common/components/tableCells/percentChangeCell';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
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
import {
  ModuleName,
  SpanMetricsField,
  type SubregionCode,
} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} =
  SpanMetricsField;

type Props = {
  primaryRelease?: string;
  secondaryRelease?: string;
  transaction?: string;
};

export function SpanOperationTable({
  transaction,
  primaryRelease,
  secondaryRelease,
}: Props) {
  const organization = useOrganization();
  const moduleURL = useModuleURL(ModuleName.MOBILE_VITALS);
  const baseURL = `${moduleURL}/details/`;

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  const cursor = decodeScalar(location.query?.[MobileCursors.SPANS_TABLE]);

  const spanOp = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';
  const subregions = decodeList(
    location.query[SpanMetricsField.USER_GEO_SUBREGION]
  ) as SubregionCode[];
  const startType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;
  const deviceClass = decodeScalar(location.query[SpanMetricsField.DEVICE_CLASS]) ?? '';

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
    `${SpanMetricsField.APP_START_TYPE}:${
      startType || `[${COLD_START_TYPE},${WARM_START_TYPE}]`
    }`,
    `${SpanMetricsField.SPAN_OP}:${spanOp ? spanOp : `[${APP_START_SPANS.join(',')}]`}`,
    ...(spanOp ? [`${SpanMetricsField.SPAN_OP}:${spanOp}`] : []),
    ...(deviceClass ? [`${SpanMetricsField.DEVICE_CLASS}:${deviceClass}`] : []),
    ...(subregions.length > 0
      ? [`${SpanMetricsField.USER_GEO_SUBREGION}:[${subregions.join(',')}]`]
      : []),
  ]);

  if (isProjectCrossPlatform) {
    searchQuery.addFilterValue('os.name', selectedPlatform);
  }

  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const sort = decodeSorts(location.query[QueryParameterNames.SPANS_SORT])[0] ?? {
    kind: 'desc',
    field: `avg_compare(${SPAN_SELF_TIME},release,${primaryRelease},${secondaryRelease})`,
  };

  const {data, meta, isPending, pageLinks} = useSpanMetrics(
    {
      cursor,
      fields: [
        PROJECT_ID,
        SPAN_OP,
        SPAN_GROUP,
        SPAN_DESCRIPTION,
        `avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`,
        `avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`,
        `avg_compare(${SPAN_SELF_TIME},release,${primaryRelease},${secondaryRelease})`,
        `sum(${SPAN_SELF_TIME})`,
      ],
      sorts: [sort],
      search: queryStringPrimary,
    },
    'api.starfish.mobile-spartup-span-table'
  );

  const columnNameMap = {
    [SPAN_OP]: t('Operation'),
    [SPAN_DESCRIPTION]: t('Span Description'),
    [`avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`]: t(
      'Avg Duration (%s)',
      PRIMARY_RELEASE_ALIAS
    ),
    [`avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`]: t(
      'Avg Duration (%s)',
      SECONDARY_RELEASE_ALIAS
    ),
    [`avg_compare(${SPAN_SELF_TIME},release,${primaryRelease},${secondaryRelease})`]:
      t('Change'),
  };

  function renderBodyCell(column: any, row: any): React.ReactNode {
    if (!meta?.fields) {
      return row[column.key];
    }

    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanMetricsField.SPAN_DESCRIPTION];

      const query = {
        ...location.query,
        transaction,
        spanOp: row[SpanMetricsField.SPAN_OP],
        spanGroup: row[SpanMetricsField.SPAN_GROUP],
        spanDescription: row[SpanMetricsField.SPAN_DESCRIPTION],
        appStartType: row[SpanMetricsField.APP_START_TYPE],
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

  return (
    <Fragment>
      <GridEditable
        isLoading={isPending}
        data={data}
        columnOrder={[
          String(SPAN_OP),
          String(SPAN_DESCRIPTION),
          `avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`,
          `avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`,
          `avg_compare(${SPAN_SELF_TIME},release,${primaryRelease},${secondaryRelease})`,
        ].map(col => {
          return {key: col, name: columnNameMap[col] ?? col, width: COL_WIDTH_UNDEFINED};
        })}
        columnSortBy={[
          {
            key: sort.field,
            order: sort.kind,
          },
        ]}
        grid={{
          renderHeadCell: column => renderHeadCell(column, meta),
          renderBodyCell,
        }}
      />
      <Pagination pageLinks={pageLinks} onCursor={handleCursor} />
    </Fragment>
  );
}
