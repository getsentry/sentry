import {Fragment, memo, useEffect, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
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
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Select} from 'sentry/components/core/select';
import {SelectOption} from 'sentry/components/core/select/option';
import {Tooltip} from 'sentry/components/core/tooltip';
import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import Pagination from 'sentry/components/pagination';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {t, tct} from 'sentry/locale';
import type {PageFilters, SelectValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Confidence, Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import type {AggregationOutputType, Sort} from 'sentry/utils/discover/fields';
import {
  getAggregateAlias,
  isAggregateField,
  isEquation,
  isEquationAlias,
  parseFunction,
  prettifyParsedFunction,
} from 'sentry/utils/discover/fields';
import {
  createOnDemandFilterWarning,
  shouldDisplayOnDemandWidgetWarning,
} from 'sentry/utils/onDemandMetrics';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  decodeInteger,
  decodeList,
  decodeScalar,
  decodeSorts,
} from 'sentry/utils/queryString';
import type {Theme} from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import withPageFilters from 'sentry/utils/withPageFilters';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
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
  isUsingPerformanceScore,
  performanceScoreTooltip,
} from 'sentry/views/dashboards/utils';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/utils/checkUserHasEditAccess';
import {
  getWidgetExploreUrl,
  getWidgetTableRowExploreUrlFunction,
} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';
import {getWidgetMetricsUrl} from 'sentry/views/dashboards/utils/getWidgetMetricsUrl';
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
import {ALLOWED_CELL_ACTIONS} from 'sentry/views/dashboards/widgets/common/settings';
import {TableWidgetVisualization} from 'sentry/views/dashboards/widgets/tableWidget/tableWidgetVisualization';
import {
  convertTableDataToTabularData,
  decodeColumnAliases,
} from 'sentry/views/dashboards/widgets/tableWidget/utils';
import {Actions} from 'sentry/views/discover/table/cellAction';
import {TransactionLink} from 'sentry/views/discover/table/tableView';
import {
  decodeColumnOrder,
  getTargetForTransactionSummaryLink,
} from 'sentry/views/discover/utils';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

import {WidgetViewerQueryField} from './widgetViewerModal/utils';

export interface WidgetViewerModalOptions {
  organization: Organization;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  confidence?: Confidence;
  dashboardCreator?: User;
  dashboardFilters?: DashboardFilters;
  dashboardPermissions?: DashboardPermissions;
  onEdit?: () => void;
  pageLinks?: string;
  sampleCount?: number;
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
  const isNotTopNWidget =
    props.widget.displayType !== DisplayType.TOP_N && !defined(props.widget.limit);
  const legendMatches = isEqual(props.legendOptions, prevProps.legendOptions);
  return selectionMatches && isNotTopNWidget && legendMatches;
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
    sampleCount,
  } = props;
  const theme = useTheme();
  const location = useLocation();
  const {projects} = useProjects();
  const navigate = useNavigate();
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

  // Timeseries Widgets (Line, Area, Bar) allow the user to specify an orderby
  // that is not explicitly selected as an aggregate or column. We need to explicitly
  // include the orderby in the table widget aggregates and columns otherwise
  // eventsv2 will complain about sorting on an unselected field.
  if (
    widget.displayType !== DisplayType.TABLE &&
    orderby &&
    !isEquationAlias(rawOrderby) &&
    // Normalize to the aggregate alias because we may still have widgets
    // that store that format
    !fields.map(getAggregateAlias).includes(getAggregateAlias(rawOrderby))
  ) {
    fields.push(rawOrderby);
    if (isAggregateField(rawOrderby) || isEquation(rawOrderby)) {
      tableWidget.queries.forEach(query => {
        if (!query.aggregates.includes(rawOrderby)) {
          query.aggregates.push(rawOrderby);
        }
      });
    } else {
      tableWidget.queries.forEach(query => {
        if (!query.columns.includes(rawOrderby)) {
          query.columns.push(rawOrderby);
        }
      });
    }
  }

  // Need to set the orderby of the eventsv2 query to equation[index] format
  // since eventsv2 does not accept the raw equation as a valid sort payload
  if (isEquation(rawOrderby) && tableWidget.queries[0]!.orderby === orderby) {
    tableWidget.queries[0]!.orderby = `${order ? '-' : ''}equation[${
      getNumEquations(fields) - 1
    }]`;
  }

  // Default table columns for visualizations that don't have a group by set
  const hasGroupBy = (widget.queries[0]?.columns.length ?? 0) > 0;
  const shouldReplaceTableColumns =
    [
      DisplayType.AREA,
      DisplayType.LINE,
      DisplayType.BIG_NUMBER,
      DisplayType.BAR,
    ].includes(widget.displayType) &&
    widget.widgetType &&
    [WidgetType.DISCOVER, WidgetType.RELEASE].includes(widget.widgetType) &&
    !hasGroupBy;

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

  const getOnDemandFilterWarning = createOnDemandFilterWarning(
    t(
      'We don’t routinely collect metrics from this property. As such, historical data may be limited.'
    )
  );

  const queryOptions = sortedQueries.map((query, index) => {
    const {name, conditions} = query;
    // Creates the highlighted query elements to be used in the Query Select
    const dashboardFiltersString = dashboardFiltersToString(
      dashboardFilters,
      widget.widgetType
    );

    const getHighlightedQuery = (
      highlightedContainerProps: React.ComponentProps<typeof HighlightContainer>
    ) => {
      const queryString = `${conditions} ${dashboardFiltersString}`.trim();
      return !name && !!queryString ? (
        <HighlightContainer {...highlightedContainerProps}>
          <ProvidedFormattedQuery
            query={queryString}
            getFilterTokenWarning={
              shouldDisplayOnDemandWidgetWarning(
                query,
                widget.widgetType ?? WidgetType.DISCOVER,
                organization
              )
                ? getOnDemandFilterWarning
                : undefined
            }
          />
        </HighlightContainer>
      ) : null;
    };

    return {
      label: truncate(name || conditions, 120),
      value: index,
      getHighlightedQuery,
    };
  });

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

  function renderTable({
    tableResults,
    loading,
    pageLinks,
  }: GenericWidgetQueriesChildrenProps) {
    return ViewerTableV2({
      tableResults,
      loading,
      pageLinks,
      fields,
      widget,
      tableWidget,
      dashboardFilters,
      modalSelection,
      setChartUnmodified,
      widths,
      location,
      organization,
      navigate,
      eventView,
      theme,
      projects,
      selectedQueryIndex,
    });
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
    return ViewerTableV2({
      tableResults,
      loading,
      pageLinks,
      fields,
      widget,
      tableWidget,
      dashboardFilters,
      modalSelection,
      setChartUnmodified,
      widths,
      location,
      organization,
      navigate,
      eventView,
      theme,
      projects,
      selectedQueryIndex,
    });
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
          return renderTable({
            tableResults: tableData,
            loading: false,
            pageLinks: defaultPageLinks,
          });
        }
        return (
          <ReleaseWidgetQueries
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
            {renderTable}
          </ReleaseWidgetQueries>
        );
      case WidgetType.DISCOVER:
      default:
        if (tableData && chartUnmodified && widget.displayType === DisplayType.TABLE) {
          return renderTable({
            tableResults: tableData,
            loading: false,
            pageLinks: defaultPageLinks,
          });
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
              return renderTable({tableResults, loading, pageLinks});
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
              widget.displayType === DisplayType.BIG_NUMBER
                ? BIG_NUMBER_HEIGHT
                : HALF_CONTAINER_HEIGHT
            }
          >
            {(!!seriesData || !!tableData) && chartUnmodified ? (
              <MemoizedWidgetCardChart
                timeseriesResults={seriesData}
                timeseriesResultsTypes={seriesResultsType}
                tableResults={tableData}
                errorMessage={undefined}
                loading={false}
                widget={widget}
                selection={selection}
                onZoom={(_evt, chart) => {
                  onZoom(_evt, chart);
                  setChartUnmodified(false);
                }}
                onLegendSelectChanged={onLegendSelectChanged}
                legendOptions={{
                  selected: widgetLegendState.getWidgetSelectionState(widget),
                }}
                noPadding
                widgetLegendState={widgetLegendState}
                showConfidenceWarning={widget.widgetType === WidgetType.SPANS}
                confidence={confidence}
                sampleCount={sampleCount}
              />
            ) : (
              <MemoizedWidgetCardChartContainer
                api={api}
                selection={modalSelection}
                dashboardFilters={dashboardFilters}
                // Top N charts rely on the orderby of the table
                widget={primaryWidget}
                onZoom={onZoom}
                onLegendSelectChanged={onLegendSelectChanged}
                legendOptions={{
                  selected: widgetLegendState.getWidgetSelectionState(widget),
                }}
                noPadding
                widgetLegendState={widgetLegendState}
                showConfidenceWarning={widget.widgetType === WidgetType.SPANS}
              />
            )}
          </Container>
        )}
        {widget.queries.length > 1 && (
          <Alert.Container>
            <Alert type="info">
              {t(
                'This widget was built with multiple queries. Table data can only be displayed for one query at a time. To edit any of the queries, edit the widget.'
              )}
            </Alert>
          </Alert.Container>
        )}
        {(widget.queries.length > 1 || widget.queries[0]!.conditions) && (
          <QueryContainer>
            <Select
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
                        padding: `0 ${theme.space.xs}`,
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
                    <SelectOption
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
                    <ButtonBar>
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
                          dashboardFilters={dashboardFilters}
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
  dashboardFilters: DashboardFilters | undefined;
  organization: Organization;
  selectedQueryIndex: number;
  selection: PageFilters;
  widget: Widget;
  disabled?: boolean;
  disabledTooltip?: string;
}

function OpenButton({
  widget,
  dashboardFilters,
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
      path = getWidgetIssueUrl(widget, dashboardFilters, selection, organization);
      break;
    case WidgetType.RELEASE:
      openLabel = t('Open in Releases');
      path = getWidgetReleasesUrl(widget, dashboardFilters, selection, organization);
      break;
    case WidgetType.SPANS:
      openLabel = t('Open in Explore');
      path = getWidgetExploreUrl(widget, dashboardFilters, selection, organization);
      break;
    case WidgetType.LOGS:
      openLabel = t('Open in Explore');
      path = getWidgetExploreUrl(widget, dashboardFilters, selection, organization);
      break;
    case WidgetType.TRACEMETRICS:
      openLabel = t('Open in Metrics');
      path = getWidgetMetricsUrl(widget, dashboardFilters, selection, organization);
      break;
    case WidgetType.DISCOVER:
    default:
      openLabel = t('Open in Discover');
      path = getWidgetDiscoverUrl(
        {...widget, queries: [widget.queries[selectedQueryIndex]!]},
        dashboardFilters,
        selection,
        organization,
        0,
        isMetricsData
      );
      break;
  }

  return (
    <Tooltip title={disabledTooltip} disabled={!disabled}>
      <LinkButton
        to={path}
        priority="primary"
        disabled={disabled}
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

interface ViewerTableV2Props {
  dashboardFilters: DashboardFilters | undefined;
  eventView: EventView;
  fields: string[];
  loading: boolean;
  location: Location;
  modalSelection: PageFilters;
  navigate: ReactRouter3Navigate;
  organization: Organization;
  projects: Project[];
  selectedQueryIndex: number;
  setChartUnmodified: React.Dispatch<React.SetStateAction<boolean>>;
  tableWidget: Widget;
  theme: Theme;
  widget: Widget;
  widths: string[];
  pageLinks?: string;
  tableResults?: TableDataWithTitle[];
}

function ViewerTableV2({
  widget,
  tableResults,
  loading,
  pageLinks,
  fields,
  widths,
  setChartUnmodified,
  tableWidget,
  location,
  organization,
  navigate,
  eventView,
  theme,
  projects,
  dashboardFilters,
  modalSelection,
  selectedQueryIndex,
}: ViewerTableV2Props) {
  const page = decodeInteger(location.query[WidgetViewerQueryField.PAGE]) ?? 0;
  const links = parseLinkHeader(pageLinks ?? null);

  function sortable(key: string) {
    if (tableWidget.widgetType === WidgetType.ISSUE) {
      return false;
    }
    if (tableWidget.widgetType === WidgetType.RELEASE) {
      return isAggregateField(key);
    }
    return true;
  }

  const columnOrder = decodeColumnOrder(
    fields.map(field => ({
      field,
    })),
    tableResults?.[0]?.meta
  );

  const tableColumns = columnOrder.map((column, index) => ({
    key: column.key,
    type: column.type === 'never' ? null : column.type,
    sortable: sortable(column.key),
    width: widths[index] ? parseInt(widths[index], 10) || -1 : -1,
  }));
  const datasetConfig = getDatasetConfig(widget.widgetType);
  const aliases = decodeColumnAliases(
    tableColumns,
    tableWidget.queries[selectedQueryIndex]?.fieldAliases ?? [],
    tableWidget.widgetType === WidgetType.ISSUE
      ? datasetConfig?.getFieldHeaderMap?.()
      : {}
  );

  // Inject any prettified function names that aren't currently aliased into the aliases
  for (const column of tableColumns) {
    const parsedFunction = parseFunction(column.key);
    if (!aliases[column.key] && parsedFunction) {
      aliases[column.key] = prettifyParsedFunction(parsedFunction);
    }
  }

  if (loading) {
    return (
      <TableWidgetVisualization.LoadingPlaceholder
        columns={tableColumns}
        aliases={aliases}
      />
    );
  }

  const tableSort = decodeSorts(tableWidget.queries[0]?.orderby)[0];
  const data = convertTableDataToTabularData(tableResults?.[0]);

  function onChangeSort(newSort: Sort) {
    if (
      [DisplayType.TOP_N, DisplayType.TABLE].includes(widget.displayType) ||
      defined(widget.limit) ||
      tableWidget.widgetType === WidgetType.ISSUE
    ) {
      setChartUnmodified(false);
    }

    trackAnalytics('dashboards_views.widget_viewer.sort', {
      organization,
      widget_type: widget.widgetType ?? WidgetType.DISCOVER,
      display_type: widget.displayType,
      column: newSort.field,
      order: newSort.kind,
    });

    navigate(
      {
        ...location,
        query: {
          ...location.query,
          sort: `${newSort.kind === 'desc' ? '-' : ''}${newSort.field}`,
        },
      },
      {replace: true, preventScrollReset: true}
    );
  }

  let cellActions: Actions[] = [];
  if (organization.features.includes('discover-cell-actions-v2')) {
    cellActions =
      tableWidget.widgetType === WidgetType.SPANS
        ? [...ALLOWED_CELL_ACTIONS, Actions.OPEN_ROW_IN_EXPLORE]
        : ALLOWED_CELL_ACTIONS;
  }

  return (
    <Fragment>
      <TableWidgetVisualization
        tableData={data}
        columns={tableColumns}
        aliases={aliases}
        sort={tableSort}
        onChangeSort={onChangeSort}
        getRenderer={(field, dataRow, meta) => {
          // getCustomFieldRenderer should be defined for all datasets, and getFieldRenderer should be used as a fallback, hence the renderer is always defined
          const customRenderer = datasetConfig?.getCustomFieldRenderer?.(
            field,
            meta as MetaType,
            widget,
            organization
          )!;

          if (field === 'transaction' && dataRow.transaction) {
            return function (cellData, baggage) {
              return (
                <TransactionLink
                  data-test-id="widget-viewer-transaction-link"
                  to={getTargetForTransactionSummaryLink(
                    dataRow,
                    organization,
                    projects,
                    eventView
                  )}
                >
                  {customRenderer(cellData, baggage)}
                </TransactionLink>
              );
            };
          }

          return customRenderer;
        }}
        makeBaggage={(field, _dataRow, meta) => {
          const unit = meta.units?.[field] as string | undefined;

          return {
            location,
            organization,
            theme,
            unit,
            eventView,
          } satisfies RenderFunctionBaggage;
        }}
        allowedCellActions={cellActions}
        onTriggerCellAction={(action, _value, dataRow) => {
          if (action === Actions.OPEN_ROW_IN_EXPLORE) {
            const getExploreUrl = getWidgetTableRowExploreUrlFunction(
              modalSelection,
              widget,
              organization,
              dashboardFilters,
              selectedQueryIndex
            );
            navigate(getExploreUrl(dataRow));
          }
        }}
      />
      {!(
        tableWidget.queries[0]!.orderby.match(/^-?release$/) &&
        tableWidget.widgetType === WidgetType.RELEASE
      ) &&
        (links?.previous?.results || links?.next?.results) && (
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
                {replace: true, preventScrollReset: true}
              );

              if (widget.displayType === DisplayType.TABLE) {
                setChartUnmodified(false);
              }

              trackAnalytics('dashboards_views.widget_viewer.paginate', {
                organization,
                widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                display_type: widget.displayType,
              });
            }}
          />
        )}
    </Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;

export const backdropCss = css`
  z-index: 9998;
`;

const Container = styled('div')<{height?: number | null}>`
  display: flex;
  flex-direction: column;
  height: ${p => (p.height ? `${p.height}px` : 'auto')};
  position: relative;
  padding-bottom: ${p => p.theme.space['2xl']};
`;

const QueryContainer = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};
  position: relative;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  position: absolute;
  top: ${p => p.theme.space.lg};
  right: ${p => p.theme.space.xl};
`;

const HighlightContainer = styled('span')<{display?: 'block' | 'flex'}>`
  display: ${p => p.display};
  gap: ${p => p.theme.space.md};
  flex: 1;
`;

const ResultsContainer = styled('div')`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
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
  gap: ${p => p.theme.space.md};
`;

const WidgetTitleRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

export default withPageFilters(WidgetViewerModal);
