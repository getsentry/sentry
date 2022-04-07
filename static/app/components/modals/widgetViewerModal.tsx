import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {components} from 'react-select';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {truncate} from '@sentry/utils';
import {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';
import moment from 'moment';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import SelectControl from 'sentry/components/forms/selectControl';
import Option from 'sentry/components/forms/selectOption';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import HighlightQuery from 'sentry/components/searchSyntax/renderer';
import {IconEdit} from 'sentry/icons/iconEdit';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getAggregateAlias, isAggregateField} from 'sentry/utils/discover/fields';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeInteger, decodeList, decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  eventViewFromWidget,
  getFieldsFromEquations,
  getWidgetDiscoverUrl,
  getWidgetIssueUrl,
} from 'sentry/views/dashboardsV2/utils';
import WidgetCardChart from 'sentry/views/dashboardsV2/widgetCard/chart';
import IssueWidgetQueries from 'sentry/views/dashboardsV2/widgetCard/issueWidgetQueries';
import {WidgetCardChartContainer} from 'sentry/views/dashboardsV2/widgetCard/widgetCardChartContainer';
import WidgetQueries from 'sentry/views/dashboardsV2/widgetCard/widgetQueries';
import {decodeColumnOrder} from 'sentry/views/eventsV2/utils';

import {WidgetViewerQueryField} from './widgetViewerModal/utils';
import {
  renderDiscoverGridHeaderCell,
  renderGridBodyCell,
  renderIssueGridHeaderCell,
} from './widgetViewerModal/widgetViewerTableCell';

export type WidgetViewerModalOptions = {
  organization: Organization;
  widget: Widget;
  onEdit?: () => void;
  seriesData?: Series[];
  tableData?: TableDataWithTitle[];
};

type Props = ModalRenderProps &
  WithRouterProps &
  WidgetViewerModalOptions & {
    organization: Organization;
    selection: PageFilters;
  };

const FULL_TABLE_ITEM_LIMIT = 20;
const HALF_TABLE_ITEM_LIMIT = 10;
const GEO_COUNTRY_CODE = 'geo.country_code';
const HALF_CONTAINER_HEIGHT = 300;
const EMPTY_QUERY_NAME = '(Empty Query Condition)';

// WidgetCardChartContainer rerenders if selection was changed.
// This is required because we want to prevent ECharts interactions from
// causing unnecessary rerenders which can break persistent legends functionality.
const MemoizedWidgetCardChartContainer = React.memo(
  WidgetCardChartContainer,
  (prevProps, props) => {
    return (
      props.selection === prevProps.selection &&
      props.location.query[WidgetViewerQueryField.QUERY] ===
        prevProps.location.query[WidgetViewerQueryField.QUERY] &&
      props.location.query[WidgetViewerQueryField.SORT] ===
        prevProps.location.query[WidgetViewerQueryField.SORT] &&
      props.location.query[WidgetViewerQueryField.WIDTH] ===
        prevProps.location.query[WidgetViewerQueryField.WIDTH]
    );
  }
);

const MemoizedWidgetCardChart = React.memo(WidgetCardChart, (prevProps, props) => {
  return (
    props.selection === prevProps.selection &&
    props.location.query[WidgetViewerQueryField.QUERY] ===
      prevProps.location.query[WidgetViewerQueryField.QUERY] &&
    props.location.query[WidgetViewerQueryField.SORT] ===
      prevProps.location.query[WidgetViewerQueryField.SORT] &&
    props.location.query[WidgetViewerQueryField.WIDTH] ===
      prevProps.location.query[WidgetViewerQueryField.WIDTH]
  );
});

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
  } = props;
  // Get widget zoom from location
  // We use the start and end query params for just the initial state
  const start = decodeScalar(location.query[WidgetViewerQueryField.START]);
  const end = decodeScalar(location.query[WidgetViewerQueryField.END]);
  const isTableWidget = widget.displayType === DisplayType.TABLE;
  const locationPageFilter =
    start && end
      ? {
          ...selection,
          datetime: {start, end, period: null, utc: null},
        }
      : selection;

  const [chartUnmodified, setChartUnmodified] = React.useState<boolean>(true);

  const [modalSelection, setModalSelection] =
    React.useState<PageFilters>(locationPageFilter);

  // Detect when a user clicks back and set the PageFilter state to match the location
  // We need to use useEffect to prevent infinite looping rerenders due to the setModalSelection call
  React.useEffect(() => {
    if (location.action === 'POP') {
      setModalSelection(locationPageFilter);
    }
  }, [location]);

  // Get legends toggle settings from location
  // We use the legend query params for just the initial state
  const [disabledLegends, setDisabledLegends] = React.useState<{[key: string]: boolean}>(
    decodeList(location.query[WidgetViewerQueryField.LEGEND]).reduce((acc, legend) => {
      acc[legend] = false;
      return acc;
    }, {})
  );
  const [totalResults, setTotalResults] = React.useState<string | undefined>();

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
  const sortedQueries = sort
    ? widget.queries.map(query => ({...query, orderby: sort}))
    : widget.queries;

  // Top N widget charts results rely on the sorting of the query
  const primaryWidget =
    widget.displayType === DisplayType.TOP_N
      ? {...widget, queries: sortedQueries}
      : widget;
  const api = useApi();

  // Create Table widget
  const tableWidget = {
    ...cloneDeep({...widget, queries: [sortedQueries[selectedQueryIndex]]}),
    displayType: DisplayType.TABLE,
  };
  const {aggregates, columns} = tableWidget.queries[0];

  const fields = defined(tableWidget.queries[0].fields)
    ? tableWidget.queries[0].fields
    : [...columns, ...aggregates];

  // World Map view should always have geo.country in the table chart
  if (
    widget.displayType === DisplayType.WORLD_MAP &&
    !columns.includes(GEO_COUNTRY_CODE)
  ) {
    fields.unshift(GEO_COUNTRY_CODE);
    columns.unshift(GEO_COUNTRY_CODE);
  }
  // Default table columns for visualizations that don't have a column setting
  const shouldReplaceTableColumns = [
    DisplayType.AREA,
    DisplayType.LINE,
    DisplayType.BIG_NUMBER,
    DisplayType.BAR,
  ].includes(widget.displayType);

  let equationFieldsCount = 0;
  // Updates fields by adding any individual terms from equation fields as a column
  if (!isTableWidget) {
    const equationFields = getFieldsFromEquations(fields);
    equationFields.forEach(term => {
      if (Array.isArray(fields) && !fields.includes(term)) {
        equationFieldsCount++;
        fields.unshift(term);
      }
      if (isAggregateField(term) && !aggregates.includes(term)) {
        aggregates.unshift(term);
      }
      if (!isAggregateField(term) && !columns.includes(term)) {
        columns.unshift(term);
      }
    });
  }

  if (shouldReplaceTableColumns) {
    if (fields.length === 1) {
      tableWidget.queries[0].orderby =
        tableWidget.queries[0].orderby || `-${getAggregateAlias(fields[0])}`;
    }
    fields.unshift('title');
    columns.unshift('title');
  }

  const eventView = eventViewFromWidget(
    tableWidget.title,
    tableWidget.queries[0],
    modalSelection,
    tableWidget.displayType
  );

  let columnOrder = decodeColumnOrder(
    tableWidget.queries[0].fields?.map(field => ({
      field,
    })) ?? []
  );
  const columnSortBy = eventView.getSorts();
  // Filter out equation terms from columnOrder so we don't clutter the table
  if (shouldReplaceTableColumns && equationFieldsCount) {
    columnOrder = columnOrder.filter(
      (_, index) => index === 0 || index > equationFieldsCount
    );
  }
  columnOrder = columnOrder.map((column, index) => ({
    ...column,
    width: parseInt(widths[index], 10) || -1,
  }));

  const queryOptions = sortedQueries.map(({name, conditions}, index) => {
    // Creates the highlighted query elements to be used in the Query Select
    const parsedQuery = !!!name && !!conditions ? parseSearch(conditions) : null;
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
  React.useEffect(() => {
    const getDiscoverTotals = async () => {
      if (widget.widgetType !== WidgetType.ISSUE) {
        setTotalResults(await fetchDiscoverTotal(api, organization, location, eventView));
      }
    };
    getDiscoverTotals();
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

  function onZoom(_evt, chart) {
    // @ts-ignore getModel() is private but we need this to retrieve datetime values of zoomed in region
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
  }

  const shouldUseDataFromProps = (!!seriesData || !!tableData) && chartUnmodified;

  function renderWidgetViewer() {
    return (
      <React.Fragment>
        {widget.displayType !== DisplayType.TABLE && (
          <Container
            height={
              widget.displayType !== DisplayType.BIG_NUMBER ? HALF_CONTAINER_HEIGHT : null
            }
          >
            {shouldUseDataFromProps ? (
              <MemoizedWidgetCardChart
                timeseriesResults={seriesData}
                tableResults={tableData}
                errorMessage={undefined}
                loading={false}
                location={location}
                widget={widget}
                selection={selection}
                router={router}
                organization={organization}
                onZoom={(_evt, chart) => {
                  onZoom(_evt, chart);
                  setChartUnmodified(false);
                }}
                onLegendSelectChanged={onLegendSelectChanged}
                legendOptions={{selected: disabledLegends}}
                expandNumbers
              />
            ) : (
              <MemoizedWidgetCardChartContainer
                location={location}
                router={router}
                routes={routes}
                params={params}
                api={api}
                organization={organization}
                selection={modalSelection}
                // Top N charts rely on the orderby of the table
                widget={primaryWidget}
                onZoom={(_evt, chart) => {
                  // @ts-ignore getModel() is private but we need this to retrieve datetime values of zoomed in region
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
                }}
                onLegendSelectChanged={onLegendSelectChanged}
                legendOptions={{selected: disabledLegends}}
                expandNumbers
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
        {widget.widgetType === WidgetType.ISSUE ? (
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
          >
            {({transformedResults, loading, pageLinks, totalCount}) => {
              if (totalResults === undefined) {
                setTotalResults(totalCount);
              }
              const links = parseLinkHeader(pageLinks ?? null);
              return (
                <React.Fragment>
                  <GridEditable
                    isLoading={loading}
                    data={transformedResults}
                    columnOrder={columnOrder}
                    columnSortBy={columnSortBy}
                    grid={{
                      renderHeadCell: renderIssueGridHeaderCell({
                        location,
                        organization,
                        selection,
                        widget: tableWidget,
                      }) as (
                        column: GridColumnOrder,
                        columnIndex: number
                      ) => React.ReactNode,
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

                        trackAdvancedAnalyticsEvent(
                          'dashboards_views.widget_viewer.paginate',
                          {
                            organization,
                            widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                            display_type: widget.displayType,
                          }
                        );
                      }}
                    />
                  )}
                </React.Fragment>
              );
            }}
          </IssueWidgetQueries>
        ) : (
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
            pagination
            cursor={cursor}
          >
            {({tableResults, loading, pageLinks}) => {
              const isFirstPage = pageLinks
                ? parseLinkHeader(pageLinks).previous.results === false
                : false;
              const links = parseLinkHeader(pageLinks ?? null);
              return (
                <React.Fragment>
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
                        onHeaderClick: () => setChartUnmodified(false),
                      }) as (
                        column: GridColumnOrder,
                        columnIndex: number
                      ) => React.ReactNode,
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

                        trackAdvancedAnalyticsEvent(
                          'dashboards_views.widget_viewer.paginate',
                          {
                            organization,
                            widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                            display_type: widget.displayType,
                          }
                        );
                      }}
                    />
                  )}
                </React.Fragment>
              );
            }}
          </WidgetQueries>
        )}
      </React.Fragment>
    );
  }

  let openLabel: string;
  let path: string;
  switch (widget.widgetType) {
    case WidgetType.ISSUE:
      openLabel = t('Open in Issues');
      path = getWidgetIssueUrl(primaryWidget, modalSelection, organization);
      break;
    case WidgetType.DISCOVER:
    default:
      openLabel = t('Open in Discover');
      path = getWidgetDiscoverUrl(
        {...primaryWidget, queries: [primaryWidget.queries[selectedQueryIndex]]},
        modalSelection,
        organization
      );
      break;
  }
  return (
    <React.Fragment>
      <Header closeButton>
        <h3>{widget.title}</h3>
      </Header>
      <Body>{renderWidgetViewer()}</Body>
      <Footer>
        <ResultsContainer>
          {totalResults &&
            (widget.widgetType === WidgetType.ISSUE ? (
              <span>
                {tct('[description:Total Issues:] [total]', {
                  description: <strong />,
                  total: totalResults === '1000' ? '1000+' : totalResults,
                })}
              </span>
            ) : (
              <span>
                {tct('[description:Total Events:] [total]', {
                  description: <strong />,
                  total: totalResults,
                })}
              </span>
            ))}
        </ResultsContainer>
        <ButtonBar gap={1}>
          {onEdit && widget.id && (
            <Button
              type="button"
              icon={<IconEdit />}
              onClick={() => {
                closeModal();
                onEdit();
                trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.edit', {
                  organization,
                  widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                  display_type: widget.displayType,
                });
              }}
            >
              {t('Edit Widget')}
            </Button>
          )}
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
        </ButtonBar>
      </Footer>
    </React.Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;

const Container = styled('div')<{height?: number | null}>`
  height: ${p => (p.height ? `${p.height}px` : 'auto')};
  max-height: ${HALF_CONTAINER_HEIGHT}px;
  position: relative;
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
`;

const ResultsContainer = styled('div')`
  display: flex;
  align-items: center;
  flex-grow: 1;
`;

const EmptyQueryContainer = styled('span')`
  color: ${p => p.theme.disabled};
`;

export default withRouter(withPageFilters(WidgetViewerModal));
