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
import FeatureBadge from 'sentry/components/featureBadge';
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
import Tooltip from 'sentry/components/tooltip';
import {IconInfo, IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
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
  (props, prevProps) => {
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
  } = props;
  const isTableWidget = widget.displayType === DisplayType.TABLE;
  const [modalSelection, setModalSelection] = React.useState<PageFilters>(selection);
  const [totalResults, setTotalResults] = React.useState<string | undefined>();

  // Get query selection settings from location
  const selectedQueryIndex =
    decodeInteger(location.query[WidgetViewerQueryField.QUERY]) ?? 0;

  // Get legends toggle settings from location
  const disabledLegends = decodeList(
    location.query[WidgetViewerQueryField.LEGEND]
  ).reduce((acc, legend) => {
    acc[legend] = false;
    return acc;
  }, {});

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

  function renderWidgetViewer() {
    return (
      <React.Fragment>
        {widget.displayType !== DisplayType.TABLE && (
          <Container
            height={
              widget.displayType !== DisplayType.BIG_NUMBER ? HALF_CONTAINER_HEIGHT : null
            }
          >
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
                const start = getUtcDateString(moment.utc(startValue));
                const end = getUtcDateString(moment.utc(endValue));
                setModalSelection({
                  ...modalSelection,
                  datetime: {...modalSelection.datetime, start, end, period: null},
                });
                trackAdvancedAnalyticsEvent('dashboards_views.widget_viewer.zoom', {
                  organization,
                  widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                  display_type: widget.displayType,
                });
              }}
              onLegendSelectChanged={({selected}) => {
                router.replace({
                  pathname: location.pathname,
                  query: {
                    ...location.query,
                    [WidgetViewerQueryField.LEGEND]: Object.keys(selected).filter(
                      key => !selected[key]
                    ),
                  },
                });
                trackAdvancedAnalyticsEvent(
                  'dashboards_views.widget_viewer.toggle_legend',
                  {
                    organization,
                    widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                    display_type: widget.displayType,
                  }
                );
              }}
              legendOptions={{selected: disabledLegends}}
              expandNumbers
            />
          </Container>
        )}
        {widget.queries.length > 1 && (
          <StyledAlert type="info" icon={<IconInfo />}>
            {t(
              'This widget was built with multiple queries. Table data can only be displayed for one query at a time.'
            )}
          </StyledAlert>
        )}
        {(widget.queries.length > 1 || widget.queries[0].conditions) && (
          <StyledSelectControlRowContainer>
            <StyledSelectControl
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
                      <StyledIconSearch />
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
            <StyledQuestionTooltip
              title={t('Widget queries can be edited by clicking "Edit Widget".')}
              size="sm"
            />
          </StyledSelectControlRowContainer>
        )}
        <TableContainer>
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
                          ...props,
                          widget: tableWidget,
                        }) as (
                          column: GridColumnOrder,
                          columnIndex: number
                        ) => React.ReactNode,
                        renderBodyCell: renderGridBodyCell({
                          ...props,
                          widget: tableWidget,
                        }),
                        onResizeColumn,
                      }}
                      location={location}
                    />
                    {(links?.previous?.results || links?.next?.results) && (
                      <StyledPagination
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
                      <StyledPagination
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
        </TableContainer>
      </React.Fragment>
    );
  }

  const StyledHeader = styled(Header)`
    ${headerCss}
  `;
  const StyledFooter = styled(Footer)`
    ${footerCss}
  `;

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
      <StyledHeader closeButton>
        <Tooltip title={widget.title} showOnlyOnOverflow>
          <WidgetTitle>{widget.title}</WidgetTitle>
        </Tooltip>
        <FeatureBadge type="beta" />
      </StyledHeader>
      <Body>{renderWidgetViewer()}</Body>
      <StyledFooter>
        <TotalResultsContainer>
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
        </TotalResultsContainer>
        <ButtonBarContainer>
          <StyledButtonBar gap={1}>
            {onEdit && widget.id && (
              <Button
                type="button"
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
                trackAdvancedAnalyticsEvent(
                  'dashboards_views.widget_viewer.open_source',
                  {
                    organization,
                    widget_type: widget.widgetType ?? WidgetType.DISCOVER,
                    display_type: widget.displayType,
                  }
                );
              }}
            >
              {openLabel}
            </Button>
          </StyledButtonBar>
        </ButtonBarContainer>
      </StyledFooter>
    </React.Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 1400px;
`;

const headerCss = css`
  margin: -${space(4)} -${space(4)} 0px -${space(4)};
  line-height: normal;
  display: flex;
`;
const footerCss = css`
  margin: 0px -${space(4)} -${space(4)};
  flex-wrap: wrap;
`;

const Container = styled('div')<{height?: number | null}>`
  height: ${p => (p.height ? `${p.height}px` : 'auto')};
  max-height: ${HALF_CONTAINER_HEIGHT}px;
  position: relative;

  & > div {
    padding: ${space(1.5)} 0px;
  }
`;
const StyledAlert = styled(Alert)`
  margin: ${space(1)} 0 0 0;
`;

const StyledSelectControl = styled(SelectControl)`
  display: flex;
  & > div {
    width: 100%;
  }
  & input {
    height: 0;
  }
  flex: 1;
`;

// Table Container allows Table display to work around parent padding and fill full modal width
const TableContainer = styled('div')`
  max-width: 1400px;
  position: relative;
  margin: ${space(2)} 0;
  & > div {
    margin: 0;
  }

  & td:first-child {
    padding: ${space(1)} ${space(2)};
  }

  & table {
    overflow-y: hidden;
  }
`;

const WidgetTitle = styled('h4')`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const StyledPagination = styled(Pagination)`
  padding-top: ${space(2)};
`;

const HighlightContainer = styled('span')<{display?: 'block' | 'flex'}>`
  flex: 1;
  display: ${p => p.display};
  gap: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${space(1.5)};
  line-height: 2;
`;

const TotalResultsContainer = styled('span')`
  margin-top: auto;
  margin-bottom: ${space(1)};
  font-size: 0.875rem;
  text-align: right;
`;

const ButtonBarContainer = styled('span')`
  display: flex;
  flex-grow: 1;
  flex-direction: row-reverse;
`;

const StyledButtonBar = styled(ButtonBar)`
  width: fit-content;
`;

const EmptyQueryContainer = styled('span')`
  color: ${p => p.theme.disabled};
`;

const StyledIconSearch = styled(IconSearch)`
  margin: auto ${space(1.5)} auto 0;
`;

const StyledSelectControlRowContainer = styled('span')`
  display: flex;
  margin-top: ${space(2)};
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  padding-left: ${space(1)};
  margin: auto;
`;

export default withRouter(withPageFilters(WidgetViewerModal));
