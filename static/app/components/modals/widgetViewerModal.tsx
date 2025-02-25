import {Fragment, memo, useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {truncate} from '@sentry/core';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import trimStart from 'lodash/trimStart';
import moment from 'moment-timezone';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Alert} from 'sentry/components/core/alert/alert';
import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Option from 'sentry/components/forms/controls/selectOption';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import HighlightQuery from 'sentry/components/searchSyntax/renderer';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters, SelectValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Confidence, Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {
  isAggregateField,
  isEquation,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import {
  createOnDemandFilterWarning,
  shouldDisplayOnDemandWidgetWarning,
} from 'sentry/utils/onDemandMetrics';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeInteger, decodeList, decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import withPageFilters from 'sentry/utils/withPageFilters';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/detail';
import {DiscoverSplitAlert} from 'sentry/views/dashboards/discoverSplitAlert';
import type {
  DashboardFilters,
  DashboardPermissions,
  Widget,
} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  dashboardFiltersToString,
  eventViewFromWidget,
  getFieldsFromEquations,
  getNumEquations,
  getWidgetDiscoverUrl,
  getWidgetIssueUrl,
  getWidgetReleasesUrl,
  hasDatasetSelector,
  isUsingPerformanceScore,
  performanceScoreTooltip,
} from 'sentry/views/dashboards/utils';
import {getWidgetExploreUrl} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';
import {
  SESSION_DURATION_ALERT,
  WidgetDescription,
} from 'sentry/views/dashboards/widgetCard';
import WidgetCardChart from 'sentry/views/dashboards/widgetCard/chart';
import {
  DashboardsMEPProvider,
  useDashboardsMEPContext,
} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import type {GenericWidgetQueriesChildrenProps} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import IssueWidgetQueries from 'sentry/views/dashboards/widgetCard/issueWidgetQueries';
import ReleaseWidgetQueries from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';
import {WidgetCardChartContainer} from 'sentry/views/dashboards/widgetCard/widgetCardChartContainer';
import WidgetQueries from 'sentry/views/dashboards/widgetCard/widgetQueries';
import type WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';
import {decodeColumnOrder} from 'sentry/views/discover/utils';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

import {WidgetViewerQueryField} from './widgetViewerModal/utils';
import {
  renderDiscoverGridHeaderCell,
  renderGridBodyCell,
  renderIssueGridHeaderCell,
  renderReleaseGridHeaderCell,
} from './widgetViewerModal/widgetViewerTableCell';

export interface WidgetViewerModalOptions {
  organization: Organization;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  confidence?: Confidence;
  dashboardCreator?: User;
  dashboardFilters?: DashboardFilters;
  dashboardPermissions?: DashboardPermissions;
  onEdit?: () => void;
  onMetricWidgetEdit?: (widget: Widget) => void;
  pageLinks?: string;
  seriesData?: Series[];
  seriesResultsType?: Record<string, AggregationOutputType>;
  tableData?: TableDataWithTitle[];
  totalIssuesCount?: string;
}

interface Props extends ModalRenderProps, WidgetViewerModalOptions {
  organization: Organization;
  selection: PageFilters;
}

const FULL_TABLE_ITEM_LIMIT = 20;
const HALF_TABLE_ITEM_LIMIT = 10;
const HALF_CONTAINER_HEIGHT = 300;
const BIG_NUMBER_HEIGHT = 160;
const EMPTY_QUERY_NAME = '(Empty Query Condition)';

const shouldWidgetCardChartMemo = (prevProps: any, props: any) => {
  const selectionMatches = props.selection === prevProps.selection;
  const sortMatches =
    props.location.query[WidgetViewerQueryField.SORT] ===
    prevProps.location.query[WidgetViewerQueryField.SORT];
  const isNotTopNWidget =
    props.widget.displayType !== DisplayType.TOP_N && !defined(props.widget.limit);
  const legendMatches = isEqual(props.legendOptions, prevProps.legendOptions);
  return selectionMatches && (sortMatches || isNotTopNWidget) && legendMatches;
};

// WidgetCardChartContainer and WidgetCardChart rerenders if selection was changed.
// This is required because we want to prevent ECharts interactions from causing
// unnecessary rerenders which can break legends and zoom functionality.
const MemoizedWidgetCardChartContainer = memo(
  WidgetCardChartContainer,
  shouldWidgetCardChartMemo
);
const MemoizedWidgetCardChart = memo(WidgetCardChart, shouldWidgetCardChartMemo);

async function fetchDiscoverTotal(
  api: Client,
  organization: Organization,
  location: Location,
  eventView: EventView
): Promise<string | undefined> {
  if (!eventView.isValid()) {
    return undefined;
  }

  try {
    const total = await fetchTotalCount(
      api,
      organization.slug,
      eventView.getEventsAPIPayload(location)
    );
    return total.toLocaleString();
  } catch (err) {
    Sentry.captureException(err);
    return undefined;
  }
}

function WidgetViewerModal(props: Props) {
  const {
    organization,
    widget,
    selection,
    Footer,
    Body,
    Header,
    closeModal,
    onEdit,
    seriesData,
    tableData,
    totalIssuesCount,
    pageLinks: defaultPageLinks,
    seriesResultsType,
    dashboardFilters,
    widgetLegendState,
    dashboardPermissions,
    dashboardCreator,
    confidence,
  } = props;
  const location = useLocation();
  const {projects} = useProjects();
  const navigate = useNavigate();
  // TODO(Tele-Team): Re-enable this when we have a better way to determine if the data is transaction only
  // let widgetContentLoadingStatus: boolean | undefined = undefined;
  // Get widget zoom from location
  // We use the start and end query params for just the initial state
  const start = decodeScalar(location.query[WidgetViewerQueryField.START]);
  const end = decodeScalar(location.query[WidgetViewerQueryField.END]);
  const isTableWidget = widget.displayType === DisplayType.TABLE;
  const hasSessionDuration = widget.queries.some(query =>
    query.aggregates.some(aggregate => aggregate.includes('session.duration'))
  );
  const locationPageFilter = useMemo(
    () =>
      start && end
        ? {
            ...selection,
            datetime: {start, end, period: null, utc: null},
          }
        : selection,
    [start, end, selection]
  );

  const [chartUnmodified, setChartUnmodified] = useState<boolean>(true);

  const [modalSelection, setModalSelection] = useState<PageFilters>(locationPageFilter);

  // Detect when a user clicks back and set the PageFilter state to match the location
  // We need to use useEffect to prevent infinite looping rerenders due to the setModalSelection call
  useEffect(() => {
    if (location.action === 'POP') {
      setModalSelection(locationPageFilter);
    }
  }, [location, locationPageFilter]);

  const [totalResults, setTotalResults] = useState<string | undefined>();

  // Get pagination settings from location
  const page = decodeInteger(location.query[WidgetViewerQueryField.PAGE]) ?? 0;
  const cursor = decodeScalar(location.query[WidgetViewerQueryField.CURSOR]);

  // Get table column widths from location
  const widths = decodeList(location.query[WidgetViewerQueryField.WIDTH]);

  // Get table sort settings from location
  const sort = decodeScalar(location.query[WidgetViewerQueryField.SORT]);

  const sortedQueries = cloneDeep(
    sort ? widget.queries.map(query => ({...query, orderby: sort})) : widget.queries
  );

  // The table under the widget visualization can only show one query, but widgets might have multiple. Choose the query based on a URL parameter.
  // Note that the URL parameter might be incorrect or invalid, in which case we drop down to the first query
  let selectedQueryIndex =
    decodeInteger(location.query[WidgetViewerQueryField.QUERY]) ?? 0;

  if (defined(widget) && !defined(sortedQueries[selectedQueryIndex])) {
    selectedQueryIndex = 0;
  }

  // Top N widget charts (including widgets with limits) results rely on the sorting of the query
  // Set the orderby of the widget chart to match the location query params
  const primaryWidget =
    widget.displayType === DisplayType.TOP_N || widget.limit !== undefined
      ? {...widget, queries: sortedQueries}
      : widget;
  const api = useApi();

  // Create Table widget
  const tableWidget = {
    ...cloneDeep({...widget, queries: [sortedQueries[selectedQueryIndex]!]}),
    displayType: DisplayType.TABLE,
  };
  const {aggregates, columns} = tableWidget.queries[0]!;
  const {orderby} = widget.queries[0]!;
  const order = orderby.startsWith('-');
  const rawOrderby = trimStart(orderby, '-');

  const fields =
    widget.displayType === DisplayType.TABLE && defined(tableWidget.queries[0]!.fields)
      ? tableWidget.queries[0]!.fields
      : [...columns, ...aggregates];

  // Some Discover Widgets (Line, Area, Bar) allow the user to specify an orderby
  // that is not explicitly selected as an aggregate or column. We need to explicitly
  // include the orderby in the table widget aggregates and columns otherwise
  // eventsv2 will complain about sorting on an unselected field.
  if (
    widget.widgetType === WidgetType.DISCOVER &&
    orderby &&
    !isEquationAlias(rawOrderby) &&
    !fields.includes(rawOrderby)
  ) {
    fields.push(rawOrderby);
    [tableWidget, primaryWidget].forEach(aggregatesAndColumns => {
      if (isAggregateField(rawOrderby) || isEquation(rawOrderby)) {
        aggregatesAndColumns.queries.forEach(query => {
          if (!query.aggregates.includes(rawOrderby)) {
            query.aggregates.push(rawOrderby);
          }
        });
      } else {
        aggregatesAndColumns.queries.forEach(query => {
          if (!query.columns.includes(rawOrderby)) {
            query.columns.push(rawOrderby);
          }
        });
      }
    });
  }

  // Need to set the orderby of the eventsv2 query to equation[index] format
  // since eventsv2 does not accept the raw equation as a valid sort payload
  if (isEquation(rawOrderby) && tableWidget.queries[0]!.orderby === orderby) {
    tableWidget.queries[0]!.orderby = `${order ? '-' : ''}equation[${
      getNumEquations(fields) - 1
    }]`;
  }

  // Default table columns for visualizations that don't have a column setting
  const shouldReplaceTableColumns =
    [
      DisplayType.AREA,
      DisplayType.LINE,
      DisplayType.BIG_NUMBER,
      DisplayType.BAR,
    ].includes(widget.displayType) &&
    widget.widgetType &&
    [WidgetType.DISCOVER, WidgetType.RELEASE].includes(widget.widgetType) &&
    !defined(widget.limit);

  // Updates fields by adding any individual terms from equation fields as a column
  if (!isTableWidget) {
    const equationFields = getFieldsFromEquations(fields);
    equationFields.forEach(term => {
      if (isAggregateField(term) && !aggregates.includes(term)) {
        aggregates.unshift(term);
      }
      if (!isAggregateField(term) && !columns.includes(term)) {
        columns.unshift(term);
      }
    });
  }

  // Add any group by columns into table fields if missing
  columns.forEach(column => {
    if (!fields.includes(column)) {
      fields.unshift(column);
    }
  });

  if (shouldReplaceTableColumns) {
    switch (widget.widgetType) {
      case WidgetType.DISCOVER:
        if (fields.length === 1) {
          tableWidget.queries[0]!.orderby =
            tableWidget.queries[0]!.orderby || `-${fields[0]}`;
        }
        fields.unshift('title');
        columns.unshift('title');
        break;
      case WidgetType.RELEASE:
        fields.unshift('release');
        columns.unshift('release');
        break;
      default:
        break;
    }
  }

  const eventView = eventViewFromWidget(
    tableWidget.title,
    tableWidget.queries[0]!,
    modalSelection
  );

  let columnOrder = decodeColumnOrder(
    fields.map(field => ({
      field,
    }))
  );
  const columnSortBy = eventView.getSorts();
  columnOrder = columnOrder.map((column, index) => ({
    ...column,
    width: parseInt(widths[index]!, 10) || -1,
  }));

  const getOnDemandFilterWarning = createOnDemandFilterWarning(
    t(
      'We don’t routinely collect metrics from this property. As such, historical data may be limited.'
    )
  );

  const queryOptions = sortedQueries.map((query, index) => {
    const {name, conditions} = query;
    // Creates the highlighted query elements to be used in the Query Select
    const dashboardFiltersString = dashboardFiltersToString(dashboardFilters);
    const parsedQuery =
      !name && !!conditions
        ? parseSearch(
            conditions +
              (dashboardFiltersString === '' ? '' : ` ${dashboardFiltersString}`),
            {
              getFilterTokenWarning: shouldDisplayOnDemandWidgetWarning(
                query,
                widget.widgetType ?? WidgetType.DISCOVER,
                organization
              )
                ? getOnDemandFilterWarning
                : undefined,
            }
          )
        : null;
    const getHighlightedQuery = (
      highlightedContainerProps: React.ComponentProps<typeof HighlightContainer>
    ) => {
      return parsedQuery !== null ? (
        <HighlightContainer {...highlightedContainerProps}>
          <HighlightQuery parsedQuery={parsedQuery} />
        </HighlightContainer>
      ) : undefined;
    };

    return {
      label: truncate(name || conditions, 120),
      value: index,
      getHighlightedQuery,
    };
  });

  const onResizeColumn = (columnIndex: number, nextColumn: GridColumnOrder) => {
    const newWidth = nextColumn.width ? Number(nextColumn.width) : COL_WIDTH_UNDEFINED;
    const newWidths: number[] = new Array(Math.max(columnIndex, widths.length)).fill(
      COL_WIDTH_UNDEFINED
    );
    widths.forEach((width, index) => (newWidths[index] = parseInt(width, 10)));
    newWidths[columnIndex] = newWidth;
    navigate(
      {
        pathname: location.pathname,
        query: {
          ...location.query,
          [WidgetViewerQueryField.WIDTH]: newWidths,
        },
      },
      {replace: true}
    );
  };

  // Get discover result totals
  useEffect(() => {
    const getDiscoverTotals = async () => {
      if (widget.widgetType === WidgetType.DISCOVER) {
        setTotalResults(await fetchDiscoverTotal(api, organization, location, eventView));
      }
    };
    getDiscoverTotals();
    // Disabling this for now since this effect should only run on initial load and query index changes
    // Including all exhaustive deps would cause fetchDiscoverTotal on nearly every update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQueryIndex]);

  function onLegendSelectChanged({selected}: {selected: Record<string, boolean>}) {
    widgetLegendState.setWidgetSelectionState(selected, widget);
    trackAnalytics('dashboards_views.widget_viewer.toggle_legend', {
      organization,
      widget_type: widget.widgetType ?? WidgetType.DISCOVER,
      display_type: widget.displayType,
    });
  }

  function DiscoverTable({
    tableResults,
    loading,
    pageLinks,
  }: GenericWidgetQueriesChildrenProps) {
    const {isMetricsData} = useDashboardsMEPContext();
    const links = parseLinkHeader(pageLinks ?? null);
    const isFirstPage = links.previous?.results === false;
    return (
      <Fragment>
        <GridEditable
          isLoading={loading}
          data={tableResults?.[0]?.data ?? []}
          columnOrder={columnOrder}
          columnSortBy={columnSortBy}
          grid={{
            renderHeadCell: renderDiscoverGridHeaderCell({
              ...props,
              location,
              widget: tableWidget,
              tableData: tableResults?.[0],
              onHeaderClick: () => {
                if (
                  [DisplayType.TOP_N, DisplayType.TABLE].includes(widget.displayType) ||
                  defined(widget.limit)
                ) {
                  setChartUnmodified(false);
                }
              },
              isMetricsData,
            }) as (column: GridColumnOrder, columnIndex: number) => React.ReactNode,
            renderBodyCell: renderGridBodyCell({
              ...props,
              location,
              tableData: tableResults?.[0],
              isFirstPage,
              projects,
              eventView,
            }),
            onResizeColumn,
          }}
        />
        {(links?.previous?.results || links?.next?.results) && (
          <Pagination
            pageLinks={pageLinks}
            onCursor={newCursor => {
              navigate(
                {
                  pathname: location.pathname,
                  query: {
                    ...location.query,
                    [WidgetViewerQueryField.CURSOR]: newCursor,
                  },
                },
                {replace: true}
              );

              if (widget.displayType === DisplayType.TABLE) {
                setChartUnmodified(false);
              }

              trackAnalytics('dashboards_views.widget_viewer.paginate', {
                organization,
                widget_type: WidgetType.DISCOVER,
                display_type: widget.displayType,
              });
            }}
          />
        )}
      </Fragment>
    );
  }

  const renderIssuesTable = ({
    tableResults,
    loading,
    pageLinks,
    totalCount,
  }: GenericWidgetQueriesChildrenProps) => {
    if (totalResults === undefined && totalCount) {
      setTotalResults(totalCount);
    }
    const links = parseLinkHeader(pageLinks ?? null);
    return (
      <Fragment>
        <GridEditable
          isLoading={loading}
          data={tableResults?.[0]?.data ?? []}
          columnOrder={columnOrder}
          columnSortBy={columnSortBy}
          grid={{
            renderHeadCell: renderIssueGridHeaderCell({
              location,
              organization,
              selection,
              widget: tableWidget,
              onHeaderClick: () => {
                setChartUnmodified(false);
              },
            }) as (column: GridColumnOrder, columnIndex: number) => React.ReactNode,
            renderBodyCell: renderGridBodyCell({
              location,
              organization,
              selection,
              widget: tableWidget,
            }),
            onResizeColumn,
          }}
        />
        {(links?.previous?.results || links?.next?.results) && (
          <Pagination
            pageLinks={pageLinks}
            onCursor={(nextCursor, _path, _query, delta) => {
              let nextPage = isNaN(page) ? delta : page + delta;
              let newCursor = nextCursor;
              // unset cursor and page when we navigate back to the first page
              // also reset cursor if somehow the previous button is enabled on
              // first page and user attempts to go backwards
              if (nextPage <= 0) {
                newCursor = undefined;
                nextPage = 0;
              }
              navigate(
                {
                  pathname: location.pathname,
                  query: {
                    ...location.query,
                    [WidgetViewerQueryField.CURSOR]: newCursor,
                    [WidgetViewerQueryField.PAGE]: nextPage,
                  },
                },
                {replace: true}
              );

              if (widget.displayType === DisplayType.TABLE) {
                setChartUnmodified(false);
              }

              trackAnalytics('dashboards_views.widget_viewer.paginate', {
                organization,
                widget_type: WidgetType.ISSUE,
                display_type: widget.displayType,
              });
            }}
          />
        )}
      </Fragment>
    );
  };

  const renderReleaseTable: ReleaseWidgetQueries['props']['children'] = ({
    tableResults,
    loading,
    pageLinks,
  }) => {
    const links = parseLinkHeader(pageLinks ?? null);
    const isFirstPage = links.previous?.results === false;
    return (
      <Fragment>
        <GridEditable
          isLoading={loading}
          data={tableResults?.[0]?.data ?? []}
          columnOrder={columnOrder}
          columnSortBy={columnSortBy}
          grid={{
            renderHeadCell: renderReleaseGridHeaderCell({
              ...props,
              location,
              widget: tableWidget,
              tableData: tableResults?.[0],
              onHeaderClick: () => {
                if (
                  [DisplayType.TOP_N, DisplayType.TABLE].includes(widget.displayType) ||
                  defined(widget.limit)
                ) {
                  setChartUnmodified(false);
                }
              },
            }) as (column: GridColumnOrder, columnIndex: number) => React.ReactNode,
            renderBodyCell: renderGridBodyCell({
              ...props,
              location,
              tableData: tableResults?.[0],
              isFirstPage,
            }),
            onResizeColumn,
          }}
        />
        {!tableWidget.queries[0]!.orderby.match(/^-?release$/) &&
          (links?.previous?.results || links?.next?.results) && (
            <Pagination
              pageLinks={pageLinks}
              onCursor={newCursor => {
                navigate(
                  {
                    pathname: location.pathname,
                    query: {
                      ...location.query,
                      [WidgetViewerQueryField.CURSOR]: newCursor,
                    },
                  },
                  {replace: true}
                );
                trackAnalytics('dashboards_views.widget_viewer.paginate', {
                  organization,
                  widget_type: WidgetType.RELEASE,
                  display_type: widget.displayType,
                });
              }}
            />
          )}
      </Fragment>
    );
  };

  const onZoom = (_evt: any, chart: any) => {
    const model = chart.getModel();
    const {startValue, endValue} = model._payload.batch[0];
    const newStart = getUtcDateString(moment.utc(startValue));
    const newEnd = getUtcDateString(moment.utc(endValue));
    setModalSelection({
      ...modalSelection,
      datetime: {
        ...modalSelection.datetime,
        start: newStart,
        end: newEnd,
        period: null,
      },
    });
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        [WidgetViewerQueryField.START]: newStart,
        [WidgetViewerQueryField.END]: newEnd,
      },
    });
    trackAnalytics('dashboards_views.widget_viewer.zoom', {
      organization,
      widget_type: widget.widgetType ?? WidgetType.DISCOVER,
      display_type: widget.displayType,
    });
  };

  function renderWidgetViewerTable() {
    switch (widget.widgetType) {
      case WidgetType.ISSUE:
        if (tableData && chartUnmodified && widget.displayType === DisplayType.TABLE) {
          return renderIssuesTable({
            tableResults: tableData,
            loading: false,
            errorMessage: undefined,
            pageLinks: defaultPageLinks,
            totalCount: totalIssuesCount,
          });
        }
        return (
          <IssueWidgetQueries
            api={api}
            organization={organization}
            widget={tableWidget}
            selection={modalSelection}
            limit={
              widget.displayType === DisplayType.TABLE
                ? FULL_TABLE_ITEM_LIMIT
                : HALF_TABLE_ITEM_LIMIT
            }
            cursor={cursor}
            dashboardFilters={dashboardFilters}
          >
            {renderIssuesTable}
          </IssueWidgetQueries>
        );
      case WidgetType.RELEASE:
        if (tableData && chartUnmodified && widget.displayType === DisplayType.TABLE) {
          return renderReleaseTable({
            tableResults: tableData,
            loading: false,
            pageLinks: defaultPageLinks,
          });
        }
        return (
          <ReleaseWidgetQueries
            api={api}
            organization={organization}
            widget={tableWidget}
            selection={modalSelection}
            limit={
              widget.displayType === DisplayType.TABLE
                ? FULL_TABLE_ITEM_LIMIT
                : HALF_TABLE_ITEM_LIMIT
            }
            cursor={cursor}
            dashboardFilters={dashboardFilters}
          >
            {renderReleaseTable}
          </ReleaseWidgetQueries>
        );
      case WidgetType.DISCOVER:
      default:
        if (tableData && chartUnmodified && widget.displayType === DisplayType.TABLE) {
          return (
            <DiscoverTable
              tableResults={tableData}
              loading={false}
              pageLinks={defaultPageLinks}
            />
          );
        }
        return (
          <WidgetQueries
            api={api}
            organization={organization}
            widget={tableWidget}
            selection={modalSelection}
            limit={
              widget.displayType === DisplayType.TABLE
                ? FULL_TABLE_ITEM_LIMIT
                : HALF_TABLE_ITEM_LIMIT
            }
            cursor={cursor}
            dashboardFilters={dashboardFilters}
          >
            {({tableResults, loading, pageLinks}) => {
              // TODO(Tele-Team): Re-enable this when we have a better way to determine if the data is transaction only
              // small hack that improves the concurrency render of the warning triangle
              // widgetContentLoadingStatus = loading;
              return (
                <DiscoverTable
                  tableResults={tableResults}
                  loading={loading}
                  pageLinks={pageLinks}
                />
              );
            }}
          </WidgetQueries>
        );
    }
  }

  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const hasEditAccess = checkUserHasEditAccess(
    currentUser,
    userTeams,
    organization,
    dashboardPermissions,
    dashboardCreator
  );

  function renderWidgetViewer() {
    return (
      <Fragment>
        {hasSessionDuration && SESSION_DURATION_ALERT}
        {widget.displayType !== DisplayType.TABLE && (
          <Container
            height={
              widget.displayType !== DisplayType.BIG_NUMBER
                ? HALF_CONTAINER_HEIGHT
                : BIG_NUMBER_HEIGHT
            }
          >
            {(!!seriesData || !!tableData) && chartUnmodified ? (
              <MemoizedWidgetCardChart
                timeseriesResults={seriesData}
                timeseriesResultsTypes={seriesResultsType}
                tableResults={tableData}
                errorMessage={undefined}
                loading={false}
                location={location}
                widget={widget}
                selection={selection}
                organization={organization}
                onZoom={(_evt, chart) => {
                  onZoom(_evt, chart);
                  setChartUnmodified(false);
                }}
                onLegendSelectChanged={onLegendSelectChanged}
                legendOptions={{
                  selected: widgetLegendState.getWidgetSelectionState(widget),
                }}
                expandNumbers
                noPadding
                widgetLegendState={widgetLegendState}
                showConfidenceWarning={widget.widgetType === WidgetType.SPANS}
                confidence={confidence}
              />
            ) : (
              <MemoizedWidgetCardChartContainer
                location={location}
                api={api}
                organization={organization}
                selection={modalSelection}
                dashboardFilters={dashboardFilters}
                // Top N charts rely on the orderby of the table
                widget={primaryWidget}
                onZoom={onZoom}
                onLegendSelectChanged={onLegendSelectChanged}
                legendOptions={{
                  selected: widgetLegendState.getWidgetSelectionState(widget),
                }}
                expandNumbers
                noPadding
                widgetLegendState={widgetLegendState}
                showConfidenceWarning={widget.widgetType === WidgetType.SPANS}
              />
            )}
          </Container>
        )}
        {widget.queries.length > 1 && (
          <Alert.Container>
            <Alert type="info" showIcon>
              {t(
                'This widget was built with multiple queries. Table data can only be displayed for one query at a time. To edit any of the queries, edit the widget.'
              )}
            </Alert>
          </Alert.Container>
        )}
        {(widget.queries.length > 1 || widget.queries[0]!.conditions) && (
          <QueryContainer>
            <SelectControl
              value={selectedQueryIndex}
              options={queryOptions}
              onChange={(option: SelectValue<number>) => {
                navigate(
                  {
                    pathname: location.pathname,
                    query: {
                      ...location.query,
                      [WidgetViewerQueryField.QUERY]: option.value,
                      [WidgetViewerQueryField.PAGE]: undefined,
                      [WidgetViewerQueryField.CURSOR]: undefined,
                    },
                  },
                  {replace: true}
                );

                trackAnalytics('dashboards_views.widget_viewer.select_query', {
                  organization,
                  widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                  display_type: widget.displayType,
                });
              }}
              components={{
                // Replaces the displayed selected value
                SingleValue: (containerProps: any) => {
                  return (
                    <components.SingleValue
                      {...containerProps}
                      // Overwrites some of the default styling that interferes with highlighted query text
                      getStyles={() => ({
                        wordBreak: 'break-word',
                        flex: 1,
                        display: 'flex',
                        padding: `0 ${space(0.5)}`,
                      })}
                    >
                      {queryOptions[selectedQueryIndex]!.getHighlightedQuery({
                        display: 'block',
                      }) ??
                        (queryOptions[selectedQueryIndex]!.label || (
                          <EmptyQueryContainer>{EMPTY_QUERY_NAME}</EmptyQueryContainer>
                        ))}
                    </components.SingleValue>
                  );
                },
                // Replaces the dropdown options
                Option: (containerProps: any) => {
                  const highlightedQuery = containerProps.data.getHighlightedQuery({
                    display: 'flex',
                  });
                  return (
                    <Option
                      {...(highlightedQuery
                        ? {
                            ...containerProps,
                            label: highlightedQuery,
                          }
                        : containerProps.label
                          ? containerProps
                          : {
                              ...containerProps,
                              label: (
                                <EmptyQueryContainer>
                                  {EMPTY_QUERY_NAME}
                                </EmptyQueryContainer>
                              ),
                            })}
                    />
                  );
                },
                // Hide the dropdown indicator if there is only one option
                ...(widget.queries.length < 2
                  ? {IndicatorsContainer: (_: any) => null}
                  : {}),
              }}
              isSearchable={false}
              isDisabled={widget.queries.length < 2}
            />
            {widget.queries.length === 1 && (
              <StyledQuestionTooltip
                title={t('To edit this query, you must edit the widget.')}
                size="sm"
              />
            )}
          </QueryContainer>
        )}
        {renderWidgetViewerTable()}
      </Fragment>
    );
  }

  return (
    <Fragment>
      <DashboardsMEPProvider>
        <MetricsCardinalityProvider organization={organization} location={location}>
          <MetricsDataSwitcher
            organization={organization}
            eventView={eventView}
            location={location}
            hideLoadingIndicator
          >
            {metricsDataSide => (
              <MEPSettingProvider
                location={location}
                forceTransactions={metricsDataSide.forceTransactionsOnly}
              >
                <Header closeButton>
                  <WidgetHeader>
                    <WidgetTitleRow>
                      <h3>{widget.title}</h3>
                      <DiscoverSplitAlert widget={widget} />
                    </WidgetTitleRow>
                    {widget.description && (
                      <Tooltip
                        title={widget.description}
                        containerDisplayMode="grid"
                        showOnlyOnOverflow
                        isHoverable
                        position="bottom"
                      >
                        <WidgetDescription>{widget.description}</WidgetDescription>
                      </Tooltip>
                    )}
                  </WidgetHeader>
                </Header>
                <Body>{renderWidgetViewer()}</Body>
                <Footer>
                  <ResultsContainer>
                    {renderTotalResults(totalResults, widget.widgetType)}
                    <ButtonBar gap={1}>
                      {onEdit && widget.id && (
                        <Button
                          onClick={() => {
                            closeModal();
                            onEdit();
                            trackAnalytics('dashboards_views.widget_viewer.edit', {
                              organization,
                              widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                              display_type: widget.displayType,
                            });
                          }}
                          disabled={!hasEditAccess}
                          title={
                            !hasEditAccess &&
                            t('You do not have permission to edit this widget')
                          }
                        >
                          {t('Edit Widget')}
                        </Button>
                      )}
                      {widget.widgetType && (
                        <OpenButton
                          widget={primaryWidget}
                          organization={organization}
                          selection={modalSelection}
                          selectedQueryIndex={selectedQueryIndex}
                          disabled={isUsingPerformanceScore(widget)}
                          disabledTooltip={
                            isUsingPerformanceScore(widget)
                              ? performanceScoreTooltip
                              : undefined
                          }
                        />
                      )}
                    </ButtonBar>
                  </ResultsContainer>
                </Footer>
              </MEPSettingProvider>
            )}
          </MetricsDataSwitcher>
        </MetricsCardinalityProvider>
      </DashboardsMEPProvider>
    </Fragment>
  );
}

interface OpenButtonProps {
  organization: Organization;
  selectedQueryIndex: number;
  selection: PageFilters;
  widget: Widget;
  disabled?: boolean;
  disabledTooltip?: string;
}

function OpenButton({
  widget,
  selection,
  organization,
  selectedQueryIndex,
  disabled,
  disabledTooltip,
}: OpenButtonProps) {
  let openLabel: string;
  let path: string;
  const {isMetricsData} = useDashboardsMEPContext();

  switch (widget.widgetType) {
    case WidgetType.ISSUE:
      openLabel = t('Open in Issues');
      path = getWidgetIssueUrl(widget, selection, organization);
      break;
    case WidgetType.RELEASE:
      openLabel = t('Open in Releases');
      path = getWidgetReleasesUrl(widget, selection, organization);
      break;
    case WidgetType.SPANS:
      openLabel = t('Open in Explore');
      path = getWidgetExploreUrl(widget, selection, organization);
      break;
    case WidgetType.DISCOVER:
    default:
      openLabel = t('Open in Discover');
      path = getWidgetDiscoverUrl(
        {...widget, queries: [widget.queries[selectedQueryIndex]!]},
        selection,
        organization,
        0,
        isMetricsData
      );
      break;
  }

  const buttonDisabled =
    hasDatasetSelector(organization) && widget.widgetType === WidgetType.DISCOVER;

  return (
    <Tooltip
      title={
        disabledTooltip ??
        t(
          'We are splitting datasets to make them easier to digest. Please confirm the dataset for this widget by clicking Edit Widget.'
        )
      }
      disabled={defined(disabled) ? !disabled : !buttonDisabled}
    >
      <LinkButton
        to={path}
        priority="primary"
        disabled={disabled || buttonDisabled}
        onClick={() => {
          trackAnalytics('dashboards_views.widget_viewer.open_source', {
            organization,
            widget_type: widget.widgetType ?? WidgetType.DISCOVER,
            display_type: widget.displayType,
          });
        }}
      >
        {openLabel}
      </LinkButton>
    </Tooltip>
  );
}

function renderTotalResults(totalResults?: string, widgetType?: WidgetType) {
  if (totalResults === undefined) {
    return <span />;
  }
  switch (widgetType) {
    case WidgetType.ISSUE:
      return (
        <span>
          {tct('[description:Total Issues:] [total]', {
            description: <strong />,
            total: totalResults === '1000' ? '1000+' : totalResults,
          })}
        </span>
      );
    case WidgetType.DISCOVER:
      return (
        <span>
          {tct('[description:Sampled Events:] [total]', {
            description: <strong />,
            total: totalResults,
          })}
        </span>
      );
    default:
      return <span />;
  }
}

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;

const Container = styled('div')<{height?: number | null}>`
  display: flex;
  flex-direction: column;
  height: ${p => (p.height ? `${p.height}px` : 'auto')};
  position: relative;
  padding-bottom: ${space(3)};
`;

const QueryContainer = styled('div')`
  margin-bottom: ${space(2)};
  position: relative;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  position: absolute;
  top: ${space(1.5)};
  right: ${space(2)};
`;

const HighlightContainer = styled('span')<{display?: 'block' | 'flex'}>`
  display: ${p => p.display};
  gap: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 2;
  flex: 1;
`;

const ResultsContainer = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
  }
`;

const EmptyQueryContainer = styled('span')`
  color: ${p => p.theme.disabled};
`;

const WidgetHeader = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const WidgetTitleRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

export default withPageFilters(WidgetViewerModal);
