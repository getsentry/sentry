import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {truncate} from '@sentry/utils';
import cloneDeep from 'lodash/cloneDeep';
import moment from 'moment';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import FeatureBadge from 'sentry/components/featureBadge';
import SelectControl from 'sentry/components/forms/selectControl';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
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

  if (shouldReplaceTableColumns) {
    if (fields.length === 1) {
      tableWidget.queries[0].orderby =
        tableWidget.queries[0].orderby || `-${getAggregateAlias(fields[0])}`;
    }
    fields.unshift('title');
    columns.unshift('title');
  }

  if (!isTableWidget) {
    // Updates fields by adding any individual terms from equation fields as a column
    const equationFields = getFieldsFromEquations(fields);
    equationFields.forEach(term => {
      if (Array.isArray(fields) && !fields.includes(term)) {
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

  const eventView = eventViewFromWidget(
    tableWidget.title,
    tableWidget.queries[0],
    modalSelection,
    tableWidget.displayType
  );

  // Update field widths
  widths.forEach((width, index) => {
    if (eventView.fields[index]) {
      eventView.fields[index].width = parseInt(width, 10);
    }
  });

  const columnOrder = eventView.getColumns();
  const columnSortBy = eventView.getSorts();

  const queryOptions = sortedQueries.map(({name, conditions}, index) => ({
    label: truncate(name || conditions, 120),
    value: index,
  }));

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

  function renderWidgetViewer() {
    return (
      <React.Fragment>
        {widget.displayType !== DisplayType.TABLE && (
          <Container>
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
            />
          </Container>
        )}
        {widget.queries.length > 1 && (
          <React.Fragment>
            <TextContainer>
              {t(
                'This widget was built with multiple queries. Table data can only be displayed for one query at a time.'
              )}
            </TextContainer>
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
            />
          </React.Fragment>
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
              {({transformedResults, loading, pageLinks}) => {
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
        {...primaryWidget, queries: tableWidget.queries},
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
        <ButtonBar gap={1}>
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
`;

const Container = styled('div')`
  height: 300px;
  max-height: 300px;
  position: relative;

  & > div {
    padding: ${space(1.5)} 0px;
  }
`;

const TextContainer = styled('div')`
  padding: ${space(2)} 0 ${space(1.5)} 0;
  color: ${p => p.theme.gray300};
`;

const StyledSelectControl = styled(SelectControl)`
  padding-top: 10px ${space(1.5)};
  & > div {
    max-height: 40px;
  }
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
`;

const WidgetTitle = styled('h4')`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const StyledPagination = styled(Pagination)`
  padding-top: ${space(2)};
`;

export default withRouter(withPageFilters(WidgetViewerModal));
