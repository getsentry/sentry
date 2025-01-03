import {Component, type ReactNode, useEffect} from 'react';
import styled from '@emotion/styled';
import type {Location, LocationDescriptorObject} from 'history';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import type {GridColumn} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import {IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {isFieldSortable} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, getAggregateAlias} from 'sentry/utils/discover/fields';
import {MEPConsumer} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import CellAction, {Actions, updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {
  type DomainViewFilters,
  useDomainViewFilters,
} from 'sentry/views/insights/pages/useFilters';
import {getLandingDisplayFromParam} from 'sentry/views/performance/landing/utils';

import {getMEPQueryParams} from './landing/widgets/utils';
import type {TransactionThresholdMetric} from './transactionSummary/transactionThresholdModal';
import TransactionThresholdModal, {
  modalCss,
} from './transactionSummary/transactionThresholdModal';
import {
  normalizeSearchConditionsWithTransactionName,
  transactionSummaryRouteWithQuery,
} from './transactionSummary/utils';
import {COLUMN_TITLES} from './data';
import {
  createUnnamedTransactionsDiscoverTarget,
  getProject,
  getProjectID,
  getSelectedProjectPlatforms,
  UNPARAMETERIZED_TRANSACTION,
} from './utils';

type ColumnTitle = {
  title: string | ReactNode;
  tooltip?: string | ReactNode;
};

const COLUMN_TITLES_OPTIONAL_TOOLTIP = COLUMN_TITLES.map(title => {
  return {title};
});

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  setError: (msg: string | undefined) => void;
  withStaticFilters: boolean;
  columnTitles?: ColumnTitle[];
  domainViewFilters?: DomainViewFilters;
  summaryConditions?: string;
};

type State = {
  transaction: string | undefined;
  transactionThreshold: number | undefined;
  transactionThresholdMetric: TransactionThresholdMetric | undefined;
  widths: number[];
};

function getProjectFirstEventGroup(project: Project): '14d' | '30d' | '>30d' {
  const fourteen_days_ago = new Date(+new Date() - 12096e5);
  const thirty_days_ago = new Date(+new Date() - 25920e5);
  const firstEventDate = new Date(project?.firstEvent ?? '');
  if (firstEventDate > fourteen_days_ago) {
    return '14d';
  }
  if (firstEventDate > thirty_days_ago) {
    return '30d';
  }
  return '>30d';
}

function TrackHasDataAnalytics({
  children,
  isLoading,
  tableData,
}: {
  children: React.ReactNode;
  isLoading: boolean;
  tableData: TableData | null;
}): React.ReactNode {
  const organization = useOrganization();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading) {
      trackAnalytics('performance_views.overview.has_data', {
        table_data_state:
          !!tableData?.data && tableData.data.length > 0 ? 'has_data' : 'no_data',
        tab: getLandingDisplayFromParam(location)?.field,
        organization,
      });
    }
  }, [isLoading, organization, tableData?.data, location]);

  return children;
}

class _Table extends Component<Props, State> {
  state: State = {
    widths: [],
    transaction: undefined,
    transactionThreshold: undefined,
    transactionThresholdMetric: undefined,
  };

  componentDidMount(): void {
    const {organization} = this.props;
    if (!this.tableMetricSet) {
      this.tableMetricSet = true;
      trackAnalytics('performance_views.landing.table.seen', {
        organization,
      });
    }
  }
  unparameterizedMetricSet = false;
  tableMetricSet = false;

  sendUnparameterizedAnalytic(project: Project | undefined) {
    const {organization, eventView} = this.props;
    const statsPeriod = eventView.statsPeriod ?? 'other';
    const projectMetadata = this.getProjectWithinMetadata(project);

    trackAnalytics('performance_views.landing.table.unparameterized', {
      organization,
      first_event: projectMetadata.firstEventWithin,
      sent_transaction: projectMetadata.sentTransaction,
      single_project: projectMetadata.isSingleProject,
      stats_period: statsPeriod,
      hit_multi_project_cap: projectMetadata.isAtMultiCap,
    });
  }

  /**
   * Used for cluster warning and analytics.
   */
  getProjectWithinMetadata(project: Project | undefined) {
    let firstEventWithin: 'none' | '14d' | '30d' | '>30d' = 'none';
    if (!project) {
      return {
        isSingleProject: false,
        firstEventWithin,
        sentTransaction: false,
        isAtMultiCap: false,
      };
    }
    firstEventWithin = getProjectFirstEventGroup(project);
    return {
      isSingleProject: true,
      firstEventWithin,
      sentTransaction: project?.firstTransactionEvent ?? false,
      isAtMultiCap: false,
    };
  }

  handleCellAction = (column: TableColumn<keyof TableDataRow>, dataRow: TableDataRow) => {
    return (action: Actions, value: React.ReactText) => {
      const {eventView, location, organization, projects} = this.props;

      trackAnalytics('performance_views.overview.cellaction', {
        organization,
        action,
      });

      if (action === Actions.EDIT_THRESHOLD) {
        const project_threshold = dataRow.project_threshold_config!;
        const transactionName = dataRow.transaction as string;
        const projectID = getProjectID(dataRow, projects);

        openModal(
          modalProps => (
            <TransactionThresholdModal
              {...modalProps}
              organization={organization}
              transactionName={transactionName}
              eventView={eventView}
              project={projectID}
              transactionThreshold={project_threshold[1]}
              transactionThresholdMetric={project_threshold[0]}
              onApply={(threshold, metric) => {
                if (
                  threshold !== project_threshold[1] ||
                  metric !== project_threshold[0]
                ) {
                  this.setState({
                    transaction: transactionName,
                    transactionThreshold: threshold,
                    transactionThresholdMetric: metric,
                  });
                }
                addSuccessMessage(
                  tct('[transactionName] updated successfully', {
                    transactionName,
                  })
                );
              }}
            />
          ),
          {modalCss, closeEvents: 'escape-key'}
        );
        return;
      }

      const searchConditions = normalizeSearchConditionsWithTransactionName(
        eventView.query
      );

      updateQuery(searchConditions, action, column, value);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchConditions.formatString(),
        },
      });
    };
  };

  renderBodyCell(
    tableData: TableData | null,
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow
  ): React.ReactNode {
    const {eventView, organization, projects, location, withStaticFilters} = this.props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const tableMeta = tableData.meta;

    const field = String(column.key);

    const fieldRenderer = getFieldRenderer(field, tableMeta, false);
    const rendered = fieldRenderer(dataRow, {
      organization,
      location,
      unit: tableMeta.units?.[column.key],
    });

    const allowActions = [
      Actions.ADD,
      Actions.EXCLUDE,
      Actions.SHOW_GREATER_THAN,
      Actions.SHOW_LESS_THAN,
      Actions.EDIT_THRESHOLD,
    ];

    const cellActions = withStaticFilters ? [] : allowActions;
    const isUnparameterizedRow = dataRow.transaction === UNPARAMETERIZED_TRANSACTION;

    if (field === 'transaction') {
      const project = getProject(dataRow, projects);
      const projectID = project?.id;
      const summaryView = eventView.clone();
      if (dataRow['http.method']) {
        summaryView.additionalConditions.setFilterValues('http.method', [
          dataRow['http.method'] as string,
        ]);
      }
      summaryView.query = summaryView.getQueryWithAdditionalConditions();
      if (isUnparameterizedRow && !this.unparameterizedMetricSet) {
        this.sendUnparameterizedAnalytic(project);
        this.unparameterizedMetricSet = true;
      }
      const {isInDomainView, view} = this.props.domainViewFilters ?? {};

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
            view: (isInDomainView && view) || undefined,
          });

      return (
        <CellAction
          column={column}
          dataRow={dataRow}
          handleCellAction={this.handleCellAction(column, dataRow)}
          allowActions={cellActions}
        >
          <Link
            to={target}
            onClick={this.handleSummaryClick}
            style={{display: `block`, width: `100%`}}
          >
            {rendered}
          </Link>
        </CellAction>
      );
    }

    if (field.startsWith('team_key_transaction')) {
      // don't display per cell actions for team_key_transaction

      const project = getProject(dataRow, projects);
      const projectMetadata = this.getProjectWithinMetadata(project);
      if (isUnparameterizedRow) {
        if (projectMetadata.firstEventWithin === '14d') {
          return (
            <Tooltip
              title={t(
                'Transactions are grouped together until we receive enough data to identify parameter patterns.'
              )}
            >
              <UnparameterizedTooltipWrapper data-test-id="unparameterized-indicator">
                <LoadingIndicator
                  mini
                  size={16}
                  style={{margin: 0, width: 16, height: 16}}
                />
              </UnparameterizedTooltipWrapper>
            </Tooltip>
          );
        }
        return <span />;
      }
      return rendered;
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
          <CellAction
            column={column}
            dataRow={dataRow}
            handleCellAction={this.handleCellAction(column, dataRow)}
            allowActions={cellActions}
          >
            {rendered}
          </CellAction>
        </Tooltip>
      );
    }

    return (
      <CellAction
        column={column}
        dataRow={dataRow}
        handleCellAction={this.handleCellAction(column, dataRow)}
        allowActions={cellActions}
      >
        {rendered}
      </CellAction>
    );
  }

  renderBodyCellWithData = (tableData: TableData | null) => {
    return (
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => this.renderBodyCell(tableData, column, dataRow);
  };

  onSortClick(currentSortKind?: string, currentSortField?: string) {
    const {organization} = this.props;
    trackAnalytics('performance_views.landingv2.transactions.sort', {
      organization,
      field: currentSortField,
      direction: currentSortKind,
    });
  }

  paginationAnalyticsEvent = (direction: string) => {
    const {organization} = this.props;
    trackAnalytics('performance_views.landingv3.table_pagination', {
      organization,
      direction,
    });
  };

  renderHeadCell(
    tableMeta: TableData['meta'],
    column: TableColumn<keyof TableDataRow>,
    title: ColumnTitle
  ): React.ReactNode {
    const {eventView, location} = this.props;

    const align = fieldAlignment(column.name, column.type, tableMeta);
    const field = {field: column.name, width: column.width};
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
    const currentSortField = currentSort ? currentSort.field : undefined;

    const sortLink = (
      <SortLink
        align={align}
        title={title.title || field.field}
        direction={currentSortKind}
        canSort={canSort}
        generateSortLink={generateSortLink}
        onClick={() => this.onSortClick(currentSortKind, currentSortField)}
      />
    );
    if (field.field.startsWith('user_misery')) {
      return (
        <GuideAnchor target="project_transaction_threshold" position="top">
          {sortLink}
        </GuideAnchor>
      );
    }

    if (!title.tooltip) {
      return sortLink;
    }
    return (
      <Header>
        {sortLink}
        <QuestionTooltip size="xs" position="top" title={title.tooltip} isHoverable />
      </Header>
    );
  }

  renderHeadCellWithMeta = (tableMeta: TableData['meta']) => {
    const columnTitles = this.props.columnTitles ?? COLUMN_TITLES_OPTIONAL_TOOLTIP;
    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode =>
      this.renderHeadCell(tableMeta, column, columnTitles[index]);
  };

  renderPrependCellWithData = (tableData: TableData | null) => {
    const {eventView} = this.props;

    const teamKeyTransactionColumn = eventView
      .getColumns()
      .find((col: TableColumn<React.ReactText>) => col.name === 'team_key_transaction');
    return (isHeader: boolean, dataRow?: any) => {
      if (teamKeyTransactionColumn) {
        if (isHeader) {
          const star = (
            <TeamKeyTransactionWrapper>
              <IconStar
                key="keyTransaction"
                color="yellow300"
                isSolid
                data-test-id="team-key-transaction-header"
              />
            </TeamKeyTransactionWrapper>
          );
          return [
            this.renderHeadCell(tableData?.meta, teamKeyTransactionColumn, {title: star}),
          ];
        }
        return [this.renderBodyCell(tableData, teamKeyTransactionColumn, dataRow)];
      }
      return [];
    };
  };

  handleSummaryClick = () => {
    const {organization, location, projects} = this.props;
    trackAnalytics('performance_views.overview.navigate.summary', {
      organization,
      project_platforms: getSelectedProjectPlatforms(location, projects),
    });
  };

  handleResizeColumn = (columnIndex: number, nextColumn: GridColumn) => {
    const widths: number[] = [...this.state.widths];
    widths[columnIndex] = nextColumn.width
      ? Number(nextColumn.width)
      : COL_WIDTH_UNDEFINED;
    this.setState({widths});
  };

  getSortedEventView() {
    const {eventView} = this.props;

    return eventView.withSorts([
      {
        field: 'team_key_transaction',
        kind: 'desc',
      },
      ...eventView.sorts,
    ]);
  }

  render() {
    const {eventView, organization, location, setError} = this.props;
    const {widths, transaction, transactionThreshold} = this.state;
    const columnOrder = eventView
      .getColumns()
      // remove team_key_transactions from the column order as we'll be rendering it
      // via a prepended column
      .filter(
        (col: TableColumn<React.ReactText>) =>
          col.name !== 'team_key_transaction' &&
          !col.name.startsWith('count_miserable') &&
          col.name !== 'project_threshold_config'
      )
      .map((col: TableColumn<React.ReactText>, i: number) => {
        if (typeof widths[i] === 'number') {
          return {...col, width: widths[i]};
        }
        return col;
      });

    const sortedEventView = this.getSortedEventView();
    const columnSortBy = sortedEventView.getSorts();

    const prependColumnWidths = ['max-content'];

    return (
      <GuideAnchor target="performance_table" position="top-start">
        <div data-test-id="performance-table">
          <MEPConsumer>
            {value => {
              return (
                <DiscoverQuery
                  eventView={sortedEventView}
                  orgSlug={organization.slug}
                  location={location}
                  setError={error => setError(error?.message)}
                  referrer="api.performance.landing-table"
                  transactionName={transaction}
                  transactionThreshold={transactionThreshold}
                  queryExtras={getMEPQueryParams(value)}
                >
                  {({pageLinks, isLoading, tableData}) => (
                    <TrackHasDataAnalytics isLoading={isLoading} tableData={tableData}>
                      <VisuallyCompleteWithData
                        id="PerformanceTable"
                        hasData={
                          !isLoading && !!tableData?.data && tableData.data.length > 0
                        }
                        isLoading={isLoading}
                      >
                        <GridEditable
                          isLoading={isLoading}
                          data={tableData ? tableData.data : []}
                          columnOrder={columnOrder}
                          columnSortBy={columnSortBy}
                          bodyStyle={{overflow: 'visible'}}
                          grid={{
                            onResizeColumn: this.handleResizeColumn,
                            renderHeadCell: this.renderHeadCellWithMeta(
                              tableData?.meta
                            ) as any,
                            renderBodyCell: this.renderBodyCellWithData(tableData) as any,
                            renderPrependColumns: this.renderPrependCellWithData(
                              tableData
                            ) as any,
                            prependColumnWidths,
                          }}
                        />
                      </VisuallyCompleteWithData>
                      <Pagination
                        pageLinks={pageLinks}
                        paginationAnalyticsEvent={this.paginationAnalyticsEvent}
                      />
                    </TrackHasDataAnalytics>
                  )}
                </DiscoverQuery>
              );
            }}
          </MEPConsumer>
        </div>
      </GuideAnchor>
    );
  }
}

function Table(props: Omit<Props, 'summaryConditions'> & {summaryConditions?: string}) {
  const summaryConditions =
    props.summaryConditions ?? props.eventView.getQueryWithAdditionalConditions();

  const domainViewFilters = useDomainViewFilters();

  return (
    <_Table
      {...props}
      summaryConditions={summaryConditions}
      domainViewFilters={domainViewFilters}
    />
  );
}

// Align the contained IconStar with the IconStar buttons in individual table
// rows, which have 2px padding + 1px border.
const TeamKeyTransactionWrapper = styled('div')`
  padding: 3px;
`;

const UnparameterizedTooltipWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  padding: ${space(1.5)};
  grid-column-gap: ${space(0.5)};
`;

export default Table;
