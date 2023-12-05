import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {getInterval} from 'sentry/components/charts/utils';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {NewQuery} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {
  fromSorts,
  isFieldSortable,
  MetaType,
} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import toPercent from 'sentry/utils/number/toPercent';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {TableColumn} from 'sentry/views/discover/table/types';
import {OverflowEllipsisTextContainer} from 'sentry/views/starfish/components/textAlign';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {SpanOpSelector} from 'sentry/views/starfish/views/screens/screenLoadSpans/spanOpSelector';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

const {SPAN_SELF_TIME, SPAN_DESCRIPTION, SPAN_GROUP, SPAN_OP, PROJECT_ID} =
  SpanMetricsField;

type Props = {
  primaryRelease?: string;
  secondaryRelease?: string;
  transaction?: string;
};

const barColors = {
  ttid: CHART_PALETTE[17][4],
  ttfd: CHART_PALETTE[17][8],
  other: CHART_PALETTE[17][10],
};

const tooltips = {
  ttid: t('Percentage of spans that ended before TTID.'),
  ttfd: t('Percentage of spans that ended before TTFD.'),
  other: t('Percentage of spans that ended after TTID.'),
};

export function ScreenLoadSpansTable({
  transaction,
  primaryRelease,
  secondaryRelease,
}: Props) {
  const location = useLocation();
  const {selection} = usePageFilters();
  const organization = useOrganization();

  const spanOp = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';
  const truncatedPrimary = formatVersionAndCenterTruncate(primaryRelease ?? '', 15);
  const truncatedSecondary = formatVersionAndCenterTruncate(secondaryRelease ?? '', 15);

  const searchQuery = new MutableSearch([
    'transaction.op:ui.load',
    `transaction:${transaction}`,
    'has:span.description',
    ...(spanOp
      ? [`${SpanMetricsField.SPAN_OP}:${spanOp}`]
      : [
          'span.op:[file.read,file.write,ui.load,http.client,db,db.sql.room,db.sql.query,db.sql.transaction]',
        ]),
  ]);
  const queryStringPrimary = appendReleaseFilters(searchQuery, primaryRelease);

  const sort = fromSorts(
    decodeScalar(location.query[QueryParameterNames.SPANS_SORT])
  )[0] ?? {
    kind: 'desc',
    field: 'time_spent_percentage()',
  };

  const newQuery: NewQuery = {
    name: '',
    fields: [
      PROJECT_ID,
      SPAN_OP,
      SPAN_GROUP,
      SPAN_DESCRIPTION,
      `avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`,
      `avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`,
      `avg_compare(${SPAN_SELF_TIME},release,${secondaryRelease},${primaryRelease})`,
      'ttid_contribution_rate()',
      'ttid_count()',
      'ttfd_contribution_rate()',
      'ttfd_count()',
      'count()',
      'time_spent_percentage()',
      `sum(${SPAN_SELF_TIME})`,
    ],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
    interval: getInterval(selection.datetime, STARFISH_CHART_INTERVAL_FIDELITY),
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  eventView.sorts = [sort];

  const {data, isLoading, pageLinks} = useTableQuery({
    eventView,
    enabled: true,
    referrer: 'api.starfish.mobile-span-table',
  });

  const eventViewColumns = eventView.getColumns();

  const columnNameMap = {
    [SPAN_OP]: t('Operation'),
    [SPAN_DESCRIPTION]: t('Span Description'),
    'count()': t('Total Count'),
    'ttid_count()': t('Occurences'),
    'time_spent_percentage()': t('Total Time Spent'),
    [`avg_if(${SPAN_SELF_TIME},release,${primaryRelease})`]: t(
      'Duration (%s)',
      truncatedPrimary
    ),
    [`avg_if(${SPAN_SELF_TIME},release,${secondaryRelease})`]: t(
      'Duration (%s)',
      truncatedSecondary
    ),
    [`avg_compare(${SPAN_SELF_TIME},release,${secondaryRelease},${primaryRelease})`]:
      DataTitles.change,
  };

  function renderBodyCell(column, row): React.ReactNode {
    if (!data?.meta || !data?.meta.fields) {
      return row[column.key];
    }

    if (column.key === SPAN_DESCRIPTION) {
      const label = row[SpanMetricsField.SPAN_DESCRIPTION];

      const pathname = normalizeUrl(
        `/organizations/${organization.slug}/performance/mobile/screens/spans/`
      );
      const query = {
        ...location.query,
        transaction,
        spanGroup: row[SpanMetricsField.SPAN_GROUP],
        spanDescription: row[SpanMetricsField.SPAN_DESCRIPTION],
      };

      return (
        <Link to={`${pathname}?${qs.stringify(query)}`}>
          <OverflowEllipsisTextContainer>{label}</OverflowEllipsisTextContainer>
        </Link>
      );
    }

    if (column.key === 'ttid_count()') {
      const total = row['count()'];
      const ttid = row['ttid_count()'] ? parseInt(row['ttid_count()'], 10) : 0;
      const ttfd = row['ttfd_count()'] ? parseInt(row['ttfd_count()'], 10) : ttid;
      const ttfdOnly = ttfd - ttid;
      const other = total - ttfd;

      const orderedSpanContribution = [
        {key: 'ttid', value: ttid},
        {key: 'ttfd', value: ttfdOnly},
        {key: 'other', value: other},
      ];

      return (
        <RelativeOpsBreakdown data-test-id="relative-ops-breakdown">
          {orderedSpanContribution.map((contribution, index) => {
            const widthPercentage = contribution.value / total;
            if (widthPercentage === 0) {
              return null;
            }
            return (
              <div key={index} style={{width: toPercent(widthPercentage || 0)}}>
                <Tooltip title={tooltips[contribution.key]} containerDisplayMode="block">
                  <RectangleRelativeOpsBreakdown
                    style={{
                      backgroundColor: barColors[contribution.key],
                    }}
                  />
                </Tooltip>
              </div>
            );
          })}
        </RelativeOpsBreakdown>
      );
    }

    const renderer = getFieldRenderer(column.key, data?.meta.fields, false);
    const rendered = renderer(row, {
      location,
      organization,
      unit: data?.meta.units?.[column.key],
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

      const newSort = `${newSortDirection === 'desc' ? '-' : ''}${column.key}`;

      return {
        ...location,
        query: {...location.query, [QueryParameterNames.SPANS_SORT]: newSort},
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

  const columnSortBy = eventView.getSorts();

  return (
    <Fragment>
      <SpanOpSelector
        primaryRelease={primaryRelease}
        transaction={transaction}
        secondaryRelease={secondaryRelease}
      />
      <GridEditable
        isLoading={isLoading}
        data={data?.data as TableDataRow[]}
        columnOrder={eventViewColumns
          .filter(
            (col: TableColumn<React.ReactText>) =>
              ![
                String(PROJECT_ID),
                String(SPAN_GROUP),
                `sum(${SPAN_SELF_TIME})`,
                'ttid_contribution_rate()',
                'ttfd_contribution_rate()',
                'ttfd_count()',
              ].includes(col.name)
          )
          .map((col: TableColumn<React.ReactText>) => {
            return {...col, name: columnNameMap[col.key]};
          })}
        columnSortBy={columnSortBy}
        location={location}
        grid={{
          renderHeadCell: column => renderHeadCell(column, data?.meta),
          renderBodyCell,
        }}
      />
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

const RelativeOpsBreakdown = styled('div')`
  position: relative;
  display: flex;
`;

const RectangleRelativeOpsBreakdown = styled(RowRectangle)`
  position: relative;
  width: 100%;
`;
