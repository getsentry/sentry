import {Fragment, memo, useEffect, useMemo, useRef, useState} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import {components} from 'react-select';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {truncate} from '@sentry/utils';
import type {DataZoomComponentOption} from 'echarts';
import {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import trimStart from 'lodash/trimStart';
import moment from 'moment';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Option from 'sentry/components/forms/controls/selectOption';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import HighlightQuery from 'sentry/components/searchSyntax/renderer';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {
  AggregationOutputType,
  isAggregateField,
  isEquation,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {decodeInteger, decodeList, decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  eventViewFromWidget,
  getFieldsFromEquations,
  getNumEquations,
  getWidgetDiscoverUrl,
  getWidgetIssueUrl,
  getWidgetReleasesUrl,
} from 'sentry/views/dashboardsV2/utils';
import WidgetCardChart, {
  AugmentedEChartDataZoomHandler,
  SLIDER_HEIGHT,
} from 'sentry/views/dashboardsV2/widgetCard/chart';
import {
  DashboardsMEPProvider,
  useDashboardsMEPContext,
} from 'sentry/views/dashboardsV2/widgetCard/dashboardsMEPContext';
import {GenericWidgetQueriesChildrenProps} from 'sentry/views/dashboardsV2/widgetCard/genericWidgetQueries';
import IssueWidgetQueries from 'sentry/views/dashboardsV2/widgetCard/issueWidgetQueries';
import ReleaseWidgetQueries from 'sentry/views/dashboardsV2/widgetCard/releaseWidgetQueries';
import {WidgetCardChartContainer} from 'sentry/views/dashboardsV2/widgetCard/widgetCardChartContainer';
import WidgetQueries from 'sentry/views/dashboardsV2/widgetCard/widgetQueries';
import {decodeColumnOrder} from 'sentry/views/eventsV2/utils';
import {OrganizationContext} from 'sentry/views/organizationContext';
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
  onEdit?: () => void;
  pageLinks?: string;
  seriesData?: Series[];
  seriesResultsType?: Record<string, AggregationOutputType>;
  tableData?: TableDataWithTitle[];
  totalIssuesCount?: string;
}

interface Props extends ModalRenderProps, WithRouterProps, WidgetViewerModalOptions {
  organization: Organization;
  selection: PageFilters;
}

const FULL_TABLE_ITEM_LIMIT = 20;
const HALF_TABLE_ITEM_LIMIT = 10;
const GEO_COUNTRY_CODE = 'geo.country_code';
const HALF_CONTAINER_HEIGHT = 300;
const EMPTY_QUERY_NAME = '(Empty Query Condition)';

const shouldWidgetCardChartMemo = (prevProps, props) => {
  const selectionMatches = props.selection === prevProps.selection;
  const sortMatches =
    props.location.query[WidgetViewerQueryField.SORT] ===
    prevProps.location.query[WidgetViewerQueryField.SORT];
  const chartZoomOptionsMatches = isEqual(
    props.chartZoomOptions,
    prevProps.chartZoomOptions
  );
  const isNotTopNWidget =
    props.widget.displayType !== DisplayType.TOP_N && !defined(props.widget.limit);
  return selectionMatches && chartZoomOptionsMatches && (sortMatches || isNotTopNWidget);
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
    location,
    Footer,
    Body,
    Header,
    closeModal,
    onEdit,
    router,
    routes,
    params,
    seriesData,
    tableData,
    totalIssuesCount,
    pageLinks: defaultPageLinks,
    seriesResultsType,
  } = props;
  const shouldShowSlider = organization.features.includes('widget-viewer-modal-minimap');
  // Get widget zoom from location
  // We use the start and end query params for just the initial state
  const start = decodeScalar(location.query[WidgetViewerQueryField.START]);
  const end = decodeScalar(location.query[WidgetViewerQueryField.END]);
  const isTableWidget = widget.displayType === DisplayType.TABLE;
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

  const [chartZoomOptions, setChartZoomOptions] = useState<DataZoomComponentOption>({
    start: 0,
    end: 100,
  });

  // We wrap the modalChartSelection in a useRef because we do not want to recalculate this value
  // (which would cause an unnecessary rerender on calculation) except for the initial load.
  // We use this for when a user visit a widget viewer url directly.
  const [modalTableSelection, setModalTableSelection] =
    useState<PageFilters>(locationPageFilter);
  const modalChartSelection = useRef(modalTableSelection);

  // Detect when a user clicks back and set the PageFilter state to match the location
  // We need to use useEffect to prevent infinite looping rerenders due to the setModalTableSelection call
  useEffect(() => {
    if (location.action === 'POP') {
      setModalTableSelection(locationPageFilter);
      if (start && end) {
        setChartZoomOptions({
          startValue: moment.utc(start).unix() * 1000,
          endValue: moment.utc(end).unix() * 1000,
        });
      } else {
        setChartZoomOptions({start: 0, end: 100});
      }
    }
  }, [end, location, locationPageFilter, start]);

  // Get legends toggle settings from location
  // We use the legend query params for just the initial state
  const [disabledLegends, setDisabledLegends] = useState<{[key: string]: boolean}>(
    decodeList(location.query[WidgetViewerQueryField.LEGEND]).reduce((acc, legend) => {
      acc[legend] = false;
      return acc;
    }, {})
  );
  const [totalResults, setTotalResults] = useState<string | undefined>();

  // Get query selection settings from location
  const selectedQueryIndex =
    decodeInteger(location.query[WidgetViewerQueryField.QUERY]) ?? 0;

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

  // Top N widget charts (including widgets with limits) results rely on the sorting of the query
  // Set the orderby of the widget chart to match the location query params
  const primaryWidget =
    widget.displayType === DisplayType.TOP_N || widget.limit !== undefined
      ? {...widget, queries: sortedQueries}
      : widget;
  const api = useApi();

  // Create Table widget
  const tableWidget = {
    ...cloneDeep({...widget, queries: [sortedQueries[selectedQueryIndex]]}),
    displayType: DisplayType.TABLE,
  };
  const {aggregates, columns} = tableWidget.queries[0];
  const {orderby} = widget.queries[0];
  const order = orderby.startsWith('-');
  const rawOrderby = trimStart(orderby, '-');

  const fields = defined(tableWidget.queries[0].fields)
    ? tableWidget.queries[0].fields
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
  if (isEquation(rawOrderby) && tableWidget.queries[0].orderby === orderby) {
    tableWidget.queries[0].orderby = `${order ? '-' : ''}equation[${
      getNumEquations(fields) - 1
    }]`;
  }

  // World Map view should always have geo.country in the table chart
  if (
    widget.displayType === DisplayType.WORLD_MAP &&
    !columns.includes(GEO_COUNTRY_CODE)
  ) {
    fields.unshift(GEO_COUNTRY_CODE);
    columns.unshift(GEO_COUNTRY_CODE);
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
          tableWidget.queries[0].orderby =
            tableWidget.queries[0].orderby || `-${fields[0]}`;
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
    tableWidget.queries[0],
    modalTableSelection,
    tableWidget.displayType
  );

  let columnOrder = decodeColumnOrder(
    fields.map(field => ({
      field,
    })),
    organization.features.includes('discover-frontend-use-events-endpoint')
  );
  const columnSortBy = eventView.getSorts();
  columnOrder = columnOrder.map((column, index) => ({
    ...column,
    width: parseInt(widths[index], 10) || -1,
  }));

  const queryOptions = sortedQueries.map(({name, conditions}, index) => {
    // Creates the highlighted query elements to be used in the Query Select
    const parsedQuery = !name && !!conditions ? parseSearch(conditions) : null;
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
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        [WidgetViewerQueryField.WIDTH]: newWidths,
      },
    });
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
    setDisabledLegends(selected);
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        [WidgetViewerQueryField.LEGEND]: Object.keys(selected).filter(
          key => !selected[key]
        ),
      },
    });
    trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.toggle_legend', {
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
              tableData: tableResults?.[0],
              isFirstPage,
            }),
            onResizeColumn,
          }}
          location={location}
        />
        {(links?.previous?.results || links?.next?.results) && (
          <Pagination
            pageLinks={pageLinks}
            onCursor={newCursor => {
              router.replace({
                pathname: location.pathname,
                query: {
                  ...location.query,
                  [WidgetViewerQueryField.CURSOR]: newCursor,
                },
              });

              if (widget.displayType === DisplayType.TABLE) {
                setChartUnmodified(false);
              }

              trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.paginate', {
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
          location={location}
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
              router.replace({
                pathname: location.pathname,
                query: {
                  ...location.query,
                  [WidgetViewerQueryField.CURSOR]: newCursor,
                  [WidgetViewerQueryField.PAGE]: nextPage,
                },
              });

              if (widget.displayType === DisplayType.TABLE) {
                setChartUnmodified(false);
              }

              trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.paginate', {
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
              tableData: tableResults?.[0],
              isFirstPage,
            }),
            onResizeColumn,
          }}
          location={location}
        />
        {!tableWidget.queries[0].orderby.match(/^-?release$/) &&
          (links?.previous?.results || links?.next?.results) && (
            <Pagination
              pageLinks={pageLinks}
              onCursor={newCursor => {
                router.replace({
                  pathname: location.pathname,
                  query: {
                    ...location.query,
                    [WidgetViewerQueryField.CURSOR]: newCursor,
                  },
                });
                trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.paginate', {
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

  const onZoom: AugmentedEChartDataZoomHandler = (evt, chart) => {
    // @ts-ignore getModel() is private but we need this to retrieve datetime values of zoomed in region
    const model = chart.getModel();
    const {seriesStart, seriesEnd} = evt;
    let startValue, endValue;
    startValue = model._payload.batch?.[0].startValue;
    endValue = model._payload.batch?.[0].endValue;
    const seriesStartTime = seriesStart ? new Date(seriesStart).getTime() : undefined;
    const seriesEndTime = seriesEnd ? new Date(seriesEnd).getTime() : undefined;
    // Slider zoom events don't contain the raw date time value, only the percentage
    // We use the percentage with the start and end of the series to calculate the adjusted zoom
    if (startValue === undefined || endValue === undefined) {
      if (seriesStartTime && seriesEndTime) {
        const diff = seriesEndTime - seriesStartTime;
        startValue = diff * model._payload.start * 0.01 + seriesStartTime;
        endValue = diff * model._payload.end * 0.01 + seriesStartTime;
      } else {
        return;
      }
    }
    setChartZoomOptions({startValue, endValue});
    const newStart = getUtcDateString(moment.utc(startValue));
    const newEnd = getUtcDateString(moment.utc(endValue));
    setModalTableSelection({
      ...modalTableSelection,
      datetime: {
        ...modalTableSelection.datetime,
        start: newStart,
        end: newEnd,
        period: null,
      },
    });
    router.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        [WidgetViewerQueryField.START]: newStart,
        [WidgetViewerQueryField.END]: newEnd,
      },
    });
    trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.zoom', {
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
            selection={modalTableSelection}
            limit={
              widget.displayType === DisplayType.TABLE
                ? FULL_TABLE_ITEM_LIMIT
                : HALF_TABLE_ITEM_LIMIT
            }
            cursor={cursor}
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
            selection={modalTableSelection}
            limit={
              widget.displayType === DisplayType.TABLE
                ? FULL_TABLE_ITEM_LIMIT
                : HALF_TABLE_ITEM_LIMIT
            }
            cursor={cursor}
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
            selection={modalTableSelection}
            limit={
              widget.displayType === DisplayType.TABLE
                ? FULL_TABLE_ITEM_LIMIT
                : HALF_TABLE_ITEM_LIMIT
            }
            cursor={cursor}
          >
            {({tableResults, loading, pageLinks}) => (
              <DiscoverTable
                tableResults={tableResults}
                loading={loading}
                pageLinks={pageLinks}
              />
            )}
          </WidgetQueries>
        );
    }
  }

  function renderWidgetViewer() {
    return (
      <Fragment>
        {widget.displayType !== DisplayType.TABLE && (
          <Container
            height={
              widget.displayType !== DisplayType.BIG_NUMBER
                ? HALF_CONTAINER_HEIGHT +
                  (shouldShowSlider &&
                  [
                    DisplayType.AREA,
                    DisplayType.LINE,
                    DisplayType.BAR,
                    DisplayType.TOP_N,
                  ].includes(widget.displayType)
                    ? SLIDER_HEIGHT
                    : 0)
                : null
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
                router={router}
                organization={organization}
                onZoom={onZoom}
                onLegendSelectChanged={onLegendSelectChanged}
                legendOptions={{selected: disabledLegends}}
                expandNumbers
                showSlider={shouldShowSlider}
                noPadding
                chartZoomOptions={chartZoomOptions}
              />
            ) : (
              <MemoizedWidgetCardChartContainer
                location={location}
                router={router}
                routes={routes}
                params={params}
                api={api}
                organization={organization}
                selection={modalChartSelection.current}
                // Top N charts rely on the orderby of the table
                widget={primaryWidget}
                onZoom={onZoom}
                onLegendSelectChanged={onLegendSelectChanged}
                legendOptions={{selected: disabledLegends}}
                expandNumbers
                showSlider={shouldShowSlider}
                noPadding
                chartZoomOptions={chartZoomOptions}
              />
            )}
          </Container>
        )}
        {widget.queries.length > 1 && (
          <Alert type="info" showIcon>
            {t(
              'This widget was built with multiple queries. Table data can only be displayed for one query at a time. To edit any of the queries, edit the widget.'
            )}
          </Alert>
        )}
        {(widget.queries.length > 1 || widget.queries[0].conditions) && (
          <QueryContainer>
            <SelectControl
              value={selectedQueryIndex}
              options={queryOptions}
              onChange={(option: SelectValue<number>) => {
                router.replace({
                  pathname: location.pathname,
                  query: {
                    ...location.query,
                    [WidgetViewerQueryField.QUERY]: option.value,
                    [WidgetViewerQueryField.PAGE]: undefined,
                    [WidgetViewerQueryField.CURSOR]: undefined,
                  },
                });

                trackAdvancedAnalyticsEvent(
                  'dashboards_views.widget_viewer.select_query',
                  {
                    organization,
                    widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                    display_type: widget.displayType,
                  }
                );
              }}
              components={{
                // Replaces the displayed selected value
                SingleValue: containerProps => {
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
                      {queryOptions[selectedQueryIndex].getHighlightedQuery({
                        display: 'block',
                      }) ??
                        (queryOptions[selectedQueryIndex].label || (
                          <EmptyQueryContainer>{EMPTY_QUERY_NAME}</EmptyQueryContainer>
                        ))}
                    </components.SingleValue>
                  );
                },
                // Replaces the dropdown options
                Option: containerProps => {
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
                ...(widget.queries.length < 2 ? {IndicatorsContainer: _ => null} : {}),
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
      <OrganizationContext.Provider value={organization}>
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
                    <h3>{widget.title}</h3>
                  </Header>
                  <Body>{renderWidgetViewer()}</Body>
                  <Footer>
                    <ResultsContainer>
                      {renderTotalResults(totalResults, widget.widgetType)}
                      <ButtonBar gap={1}>
                        {onEdit && widget.id && (
                          <Button
                            type="button"
                            onClick={() => {
                              closeModal();
                              onEdit();
                              trackAdvancedAnalyticsEvent(
                                'dashboards_views.widget_viewer.edit',
                                {
                                  organization,
                                  widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                                  display_type: widget.displayType,
                                }
                              );
                            }}
                          >
                            {t('Edit Widget')}
                          </Button>
                        )}
                        {widget.widgetType && (
                          <OpenButton
                            widget={primaryWidget}
                            organization={organization}
                            selection={modalTableSelection}
                            selectedQueryIndex={selectedQueryIndex}
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
      </OrganizationContext.Provider>
    </Fragment>
  );
}

interface OpenButtonProps {
  organization: Organization;
  selectedQueryIndex: number;
  selection: PageFilters;
  widget: Widget;
}

function OpenButton({
  widget,
  selection,
  organization,
  selectedQueryIndex,
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
    case WidgetType.DISCOVER:
    default:
      openLabel = t('Open in Discover');
      path = getWidgetDiscoverUrl(
        {...widget, queries: [widget.queries[selectedQueryIndex]]},
        selection,
        organization,
        0,
        isMetricsData
      );
      break;
  }

  return (
    <Button
      to={path}
      priority="primary"
      type="button"
      onClick={() => {
        trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.open_source', {
          organization,
          widget_type: widget.widgetType ?? WidgetType.DISCOVER,
          display_type: widget.displayType,
        });
      }}
    >
      {openLabel}
    </Button>
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
          {tct('[description:Total Events:] [total]', {
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

export default withRouter(withPageFilters(WidgetViewerModal));
