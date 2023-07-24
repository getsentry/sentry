import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';
import * as qs from 'query-string';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import SortLink, {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import BaseSearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView, {isFieldSortable, MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {TableColumn} from 'sentry/views/discover/table/types';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {TIME_SPENT_IN_SERVICE} from 'sentry/views/starfish/utils/generatePerformanceEventView';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

const COLUMN_TITLES = [
  t('Endpoint'),
  DataTitles.throughput,
  DataTitles.p95,
  DataTitles.errorCount,
  DataTitles.timeSpent,
];

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  setError: (msg: string | undefined) => void;
};

export type TableColumnHeader = GridColumnHeader<keyof TableDataRow> & {
  column?: TableColumn<keyof TableDataRow>['column']; // TODO - remove this once gridEditable is properly typed
};

function EndpointList({eventView, location, organization, setError}: Props) {
  const [widths, setWidths] = useState<number[]>([]);
  const [_eventView, setEventView] = useState<EventView>(eventView);

  // Effect to keep the parent eventView in sync with the child, so that chart zoom and time period can be accounted for.

  useEffect(() => {
    setEventView(prevEventView => {
      const cloned = eventView.clone();
      cloned.query = prevEventView.query;
      return cloned;
    });
  }, [eventView]);

  function renderBodyCell(
    tableData: TableData | null,
    column: TableColumnHeader,
    dataRow: TableDataRow,
    _deltaColumnMap: Record<string, string>
  ): React.ReactNode {
    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta;

    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {organization, location});

    if (field === 'transaction') {
      let prefix = '';
      if (dataRow['http.method']) {
        prefix = `${dataRow['http.method']} `;
      }

      return (
        <Link
          to={`/organizations/${
            organization.slug
          }/starfish/endpoint-overview/?${qs.stringify({
            endpoint: dataRow.transaction,
            'http.method': dataRow['http.method'],
            statsPeriod: eventView.statsPeriod,
            project: eventView.project,
            start: eventView.start,
            end: eventView.end,
          })}`}
          style={{display: `block`, width: `100%`}}
          onClick={() => {
            trackAnalytics('starfish.web_service_view.endpoint_list.endpoint.clicked', {
              organization,
              endpoint: dataRow.transaction,
            });
          }}
        >
          {prefix}
          {dataRow.transaction}
        </Link>
      );
    }

    if (field === TIME_SPENT_IN_SERVICE) {
      const cumulativeTime = Number(dataRow['sum(transaction.duration)']);
      const cumulativeTimePercentage = Number(dataRow[TIME_SPENT_IN_SERVICE]);
      return (
        <TimeSpentCell
          timeSpentPercentage={cumulativeTimePercentage}
          totalSpanTime={cumulativeTime}
        />
      );
    }

    // TODO: This can be removed if/when the backend returns this field's type
    // as `"rate"` and its unit as `"1/second"
    if (field === 'tps()') {
      return <ThroughputCell throughputPerSecond={dataRow[field] as number} />;
    }

    if (field === 'project') {
      return null;
    }

    const fieldName = getAggregateAlias(field);
    const value = dataRow[fieldName];
    if (tableMeta[fieldName] === 'integer' && typeof value === 'number' && value > 999) {
      return (
        <Tooltip
          title={value.toLocaleString()}
          containerDisplayMode="block"
          position="right"
        >
          {rendered}
        </Tooltip>
      );
    }

    return rendered;
  }

  function renderBodyCellWithData(tableData: TableData | null) {
    const deltaColumnMap: Record<string, string> = {};
    if (tableData?.data?.[0]) {
      Object.keys(tableData.data[0]).forEach(col => {
        if (
          col.startsWith(
            'equation|(percentile_range(transaction.duration,0.95,lessOrEquals'
          )
        ) {
          deltaColumnMap['p95()'] = col;
        }
      });
    }

    return (column: TableColumnHeader, dataRow: TableDataRow): React.ReactNode =>
      renderBodyCell(tableData, column, dataRow, deltaColumnMap);
  }

  function renderHeadCell(
    tableMeta: TableData['meta'],
    column: TableColumnHeader,
    title: React.ReactNode
  ): React.ReactNode {
    let align: Alignments = 'right';
    if (title === 'Endpoint') {
      align = 'left';
    }
    const field = {
      field: column.column?.kind === 'equation' ? (column.key as string) : column.name,
      width: column.width,
    };

    const aggregateAliasTableMeta: MetaType = {};
    if (tableMeta) {
      Object.keys(tableMeta).forEach(key => {
        aggregateAliasTableMeta[getAggregateAlias(key)] = tableMeta[key];
      });
    }

    function generateSortLink(): LocationDescriptorObject | undefined {
      if (!tableMeta) {
        return undefined;
      }

      const nextEventView = eventView.sortOnField(field, aggregateAliasTableMeta);
      const queryStringObject = nextEventView.generateQueryStringObject();

      return {
        ...location,
        query: {...location.query, sort: queryStringObject.sort},
      };
    }
    const currentSort = eventView.sortForField(field, aggregateAliasTableMeta);
    const canSort = isFieldSortable(field, aggregateAliasTableMeta);

    const currentSortKind = currentSort ? currentSort.kind : undefined;

    const sortLink = (
      <SortLink
        align={align}
        title={title || field.field}
        direction={currentSortKind}
        canSort={canSort}
        generateSortLink={generateSortLink}
        onClick={() => {
          trackAnalytics('starfish.web_service_view.endpoint_list.header.clicked', {
            organization,
            direction: currentSortKind === 'desc' ? 'asc' : 'desc',
            header: title || field.field,
          });
        }}
      />
    );

    return sortLink;
  }

  function renderHeadCellWithMeta(tableMeta: TableData['meta']) {
    const newColumnTitles = COLUMN_TITLES;
    return (column: TableColumnHeader, index: number): React.ReactNode =>
      renderHeadCell(tableMeta, column, newColumnTitles[index]);
  }

  function handleResizeColumn(columnIndex: number, nextColumn: GridColumn) {
    setWidths(prevWidths =>
      prevWidths.map((width, index) =>
        index === columnIndex ? Number(nextColumn.width ?? COL_WIDTH_UNDEFINED) : width
      )
    );
  }

  function handleSearch(query: string) {
    const clonedEventView = eventView.clone();

    // Default to fuzzy finding for now
    clonedEventView.query += `transaction:*${query}*`;
    setEventView(clonedEventView);

    trackAnalytics('starfish.web_service_view.endpoint_list.search', {
      organization,
      query,
    });
  }

  const columnOrder = eventView
    .getColumns()
    .filter(
      (col: TableColumn<React.ReactText>) =>
        col.name !== 'project' &&
        col.name !== 'http.method' &&
        col.name !== 'total.transaction_duration' &&
        col.name !== 'sum(transaction.duration)'
    )
    .map((col: TableColumn<React.ReactText>, i: number) => {
      if (typeof widths[i] === 'number') {
        return {...col, width: widths[i]};
      }
      return col;
    });

  const columnSortBy = eventView.getSorts();

  return (
    <GuideAnchor target="performance_table" position="top-start">
      <StyledSearchBar placeholder={t('Search for endpoints')} onSearch={handleSearch} />
      <DiscoverQuery
        eventView={_eventView}
        orgSlug={organization.slug}
        location={location}
        setError={error => setError(error?.message)}
        referrer="api.starfish.endpoint-list"
        queryExtras={{dataset: 'metrics'}}
      >
        {({pageLinks, isLoading, tableData}) => (
          <Fragment>
            <GridEditable
              isLoading={isLoading}
              data={tableData ? tableData.data : []}
              columnOrder={columnOrder}
              columnSortBy={columnSortBy}
              grid={{
                onResizeColumn: handleResizeColumn,
                renderHeadCell: renderHeadCellWithMeta(tableData?.meta),
                renderBodyCell: renderBodyCellWithData(tableData),
              }}
              location={location}
            />

            <Pagination pageLinks={pageLinks} />
          </Fragment>
        )}
      </DiscoverQuery>
    </GuideAnchor>
  );
}

export default EndpointList;

const StyledSearchBar = styled(BaseSearchBar)`
  margin-bottom: ${space(2)};
`;
