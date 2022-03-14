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
import SelectControl from 'sentry/components/forms/selectControl';
import GridEditable, {
  COL_WIDTH_MINIMUM,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
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
  renderPrependColumns,
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
        prevProps.location.query[WidgetViewerQueryField.SORT]
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
  const selectedQueryIndex =
    decodeInteger(location.query[WidgetViewerQueryField.QUERY]) ?? 0;
  const disabledLegends = decodeList(
    location.query[WidgetViewerQueryField.LEGEND]
  ).reduce((acc, legend) => {
    acc[legend] = false;
    return acc;
  }, {});
  const page = decodeInteger(location.query[WidgetViewerQueryField.PAGE]) ?? 0;
  const cursor = decodeScalar(location.query[WidgetViewerQueryField.CURSOR]);

  // Use sort if provided by location query to sort table
  const sort = decodeScalar(location.query[WidgetViewerQueryField.SORT]);
  const sortedQueries = sort
    ? widget.queries.map(query => ({...query, orderby: sort}))
    : widget.queries;
  // Top N widget charts rely on the table sorting
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
  const fields = tableWidget.queries[0].fields;

  // World Map view should always have geo.country in the table chart
  if (
    widget.displayType === DisplayType.WORLD_MAP &&
    !fields.includes(GEO_COUNTRY_CODE)
  ) {
    fields.unshift(GEO_COUNTRY_CODE);
  }

  // Default table columns for visualizations that don't have a column setting
  const shouldReplaceTableColumns = [
    DisplayType.AREA,
    DisplayType.LINE,
    DisplayType.BIG_NUMBER,
    DisplayType.BAR,
  ].includes(widget.displayType);

  if (shouldReplaceTableColumns) {
    tableWidget.queries[0].orderby = tableWidget.queries[0].orderby || '-timestamp';
    fields.splice(
      0,
      fields.length,
      ...['title', 'event.type', 'project', 'user.display', 'timestamp']
    );
  }

  const prependColumnWidths = shouldReplaceTableColumns
    ? [`minmax(${COL_WIDTH_MINIMUM}px, max-content)`]
    : [];

  if (!isTableWidget) {
    // Updates fields by adding any individual terms from equation fields as a column
    const equationFields = getFieldsFromEquations(fields);
    equationFields.forEach(term => {
      if (Array.isArray(fields) && !fields.includes(term)) {
        fields.unshift(term);
      }
    });
  }
  const eventView = eventViewFromWidget(
    tableWidget.title,
    tableWidget.queries[0],
    modalSelection,
    tableWidget.displayType
  );
  const columnOrder = eventView.getColumns();
  const columnSortBy = eventView.getSorts();

  const queryOptions = sortedQueries.map(({name, conditions}, index) => ({
    label: truncate(name || conditions, 120),
    value: index,
  }));

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
                        renderPrependColumns: shouldReplaceTableColumns
                          ? renderPrependColumns({
                              ...props,
                              eventView,
                              tableData: tableResults?.[0],
                            })
                          : undefined,
                        prependColumnWidths,
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
      </StyledHeader>
      <Body>{renderWidgetViewer()}</Body>
      <StyledFooter>
        <ButtonBar gap={1}>
          {onEdit && (
            <Button
              type="button"
              onClick={() => {
                closeModal();
                onEdit();
              }}
            >
              {t('Edit Widget')}
            </Button>
          )}
          <Button to={path} priority="primary" type="button">
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
  padding-bottom: ${space(1.5)};
`;

const StyledSelectControl = styled(SelectControl)`
  padding-top: 10px ${space(1.5)};
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
