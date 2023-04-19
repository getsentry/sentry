import {Component, Fragment} from 'react';
import {Location, LocationDescriptorObject} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumn,
} from 'sentry/components/gridEditable';
import SortLink, {Alignments} from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {Tooltip} from 'sentry/components/tooltip';
import {Organization, Project} from 'sentry/types';
import DiscoverQuery, {
  TableData,
  TableDataRow,
} from 'sentry/utils/discover/discoverQuery';
import EventView, {isFieldSortable, MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  ColumnType,
  fieldAlignment,
  getAggregateAlias,
} from 'sentry/utils/discover/fields';
import {TableColumn} from 'sentry/views/discover/table/types';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

const COLUMN_TITLES = ['endpoint', 'tpm', 'p50(duration)', 'p95(duration)'];

import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import {t, tct} from 'sentry/locale';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {formatPercentage} from 'sentry/utils/formatters';
import {getProjectID} from 'sentry/views/performance/utils';
import {TIME_SPENT_IN_SERVICE} from 'sentry/views/starfish/utils/generatePerformanceEventView';

import {
  createUnnamedTransactionsDiscoverTarget,
  UNPARAMETERIZED_TRANSACTION,
} from '../../utils/createUnnamedTransactionsDiscoverTarget';

// HACK: Overrides ColumnType for TIME_SPENT_IN_SERVICE which is
// returned as a number because it's an equation, but we
// want formatted as a percentage
const TABLE_META_OVERRIDES: Record<string, ColumnType> = {
  [TIME_SPENT_IN_SERVICE]: 'percentage',
};

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  setError: (msg: string | undefined) => void;
  columnTitles?: string[];
  dataset?: 'discover' | 'metrics';
};

type State = {
  widths: number[];
};

class EndpointList extends Component<Props, State> {
  state: State = {
    widths: [],
  };

  renderBodyCell(
    tableData: TableData | null,
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow,
    deltaColumnMap: Record<string, string>
  ): React.ReactNode {
    const {eventView, organization, projects, location} = this.props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = {...tableData.meta, ...TABLE_META_OVERRIDES};

    const field = String(column.key);
    const fieldRenderer = getFieldRenderer(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {organization, location});

    if (field === 'transaction') {
      const projectID = getProjectID(dataRow, projects);
      const summaryView = eventView.clone();
      let prefix = '';
      if (dataRow['http.method']) {
        summaryView.additionalConditions.setFilterValues('http.method', [
          dataRow['http.method'] as string,
        ]);
        prefix = `${dataRow['http.method']} `;
      }
      summaryView.query = summaryView.getQueryWithAdditionalConditions();
      const isUnparameterizedRow = dataRow.transaction === UNPARAMETERIZED_TRANSACTION;
      const target = isUnparameterizedRow
        ? createUnnamedTransactionsDiscoverTarget({
            organization,
            location,
          })
        : transactionSummaryRouteWithQuery({
            orgSlug: organization.slug,
            transaction: String(dataRow.transaction) || '',
            query: summaryView.generateQueryStringObject(),
            projectID,
          });

      return (
        <Link to={target} style={{display: `block`, width: `100%`}}>
          {prefix}
          {dataRow.transaction}
        </Link>
      );
    }

    if (field === TIME_SPENT_IN_SERVICE) {
      const cumulativeTime = Number(dataRow['sum(transaction.duration)']);
      const cumulativeTimePercentage = Number(dataRow[TIME_SPENT_IN_SERVICE]);
      return (
        <Tooltip
          title={t(
            'This endpoint accounts for %s of the cumulative time on your web service',
            formatPercentage(cumulativeTimePercentage)
          )}
          containerDisplayMode="block"
          position="top"
        >
          <NumberContainer>
            {tct('[cumulativeTime] ([cumulativeTimePercentage])', {
              cumulativeTime: (
                <Duration seconds={cumulativeTime / 1000} fixedDigits={2} abbreviation />
              ),
              cumulativeTimePercentage: formatPercentage(cumulativeTimePercentage),
            })}
          </NumberContainer>
        </Tooltip>
      );
    }

    if (field === 'p50()') {
      const deltaColName = deltaColumnMap[field];
      const deltaValue = dataRow[deltaColName] as number;
      const trendDirection = deltaValue < 0 ? 'good' : deltaValue > 0 ? 'bad' : 'neutral';

      return (
        <NumberContainer>
          <Duration
            seconds={(dataRow[field] as number) / 1000}
            fixedDigits={2}
            abbreviation
          />
          &nbsp;
          <TrendingDuration trendDirection={trendDirection}>
            {tct('([sign][delta])', {
              sign: deltaValue >= 0 ? '+' : '-',
              delta: (
                <Duration
                  seconds={Math.abs(deltaValue) / 1000}
                  fixedDigits={2}
                  abbreviation
                />
              ),
            })}
          </TrendingDuration>
        </NumberContainer>
      );
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

  renderBodyCellWithData = (tableData: TableData | null) => {
    const deltaColumnMap: Record<string, string> = {};
    if (tableData?.data?.[0]) {
      Object.keys(tableData.data[0]).forEach(col => {
        if (
          col.startsWith(
            'equation|percentile_range(transaction.duration,0.50,lessOrEquals'
          )
        ) {
          deltaColumnMap['p50()'] = col;
        }
      });
    }

    return (
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => this.renderBodyCell(tableData, column, dataRow, deltaColumnMap);
  };

  renderHeadCell(
    tableMeta: TableData['meta'],
    column: TableColumn<keyof TableDataRow>,
    title: React.ReactNode
  ): React.ReactNode {
    const {eventView, location} = this.props;

    // Hack to get equations to align and sort properly because
    // some of the functions called below aren't set up to handle
    // equations. Fudging code here to keep minimal footprint of
    // code changes.
    let align: Alignments = 'left';
    if (column.column.kind === 'equation') {
      align = 'right';
    } else {
      align = fieldAlignment(column.name, column.type, tableMeta);
    }
    const field = {
      field: column.column.kind === 'equation' ? (column.key as string) : column.name,
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
      />
    );

    return sortLink;
  }

  renderHeadCellWithMeta = (tableMeta: TableData['meta']) => {
    const columnTitles = this.props.columnTitles ?? COLUMN_TITLES;
    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      this.renderHeadCell(tableMeta, column, columnTitles[index]);
  };

  handleResizeColumn = (columnIndex: number, nextColumn: GridColumn) => {
    const widths: number[] = [...this.state.widths];
    widths[columnIndex] = nextColumn.width
      ? Number(nextColumn.width)
      : COL_WIDTH_UNDEFINED;
    this.setState({widths});
  };

  render() {
    const {eventView, organization, location, setError} = this.props;
    const {widths} = this.state;
    const columnOrder = eventView
      .getColumns()
      .filter(
        (col: TableColumn<React.ReactText>) =>
          !col.name.startsWith('count_miserable') &&
          !col.name.startsWith('percentile_range') &&
          col.name !== 'project_threshold_config' &&
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
        <DiscoverQuery
          eventView={eventView}
          orgSlug={organization.slug}
          location={location}
          setError={error => setError(error?.message)}
          referrer="api.starfish.endpoint-list"
          queryExtras={{dataset: this.props.dataset ?? 'metrics'}}
        >
          {({pageLinks, isLoading, tableData}) => (
            <Fragment>
              <GridEditable
                isLoading={isLoading}
                data={tableData ? tableData.data : []}
                columnOrder={columnOrder}
                columnSortBy={columnSortBy}
                grid={{
                  onResizeColumn: this.handleResizeColumn,
                  renderHeadCell: this.renderHeadCellWithMeta(tableData?.meta) as any,
                  renderBodyCell: this.renderBodyCellWithData(tableData) as any,
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
}

export default EndpointList;

const TrendingDuration = styled('div')<{trendDirection: 'good' | 'bad' | 'neutral'}>`
  color: ${p =>
    p.trendDirection === 'good'
      ? p.theme.successText
      : p.trendDirection === 'bad'
      ? p.theme.errorText
      : p.theme.subText};
  float: right;
`;
