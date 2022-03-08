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
import GridEditable, {GridColumnOrder} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, SelectValue} from 'sentry/types';
import {getUtcDateString} from 'sentry/utils/dates';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {decodeInteger, decodeScalar} from 'sentry/utils/queryString';
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
import WidgetCardChartContainer from 'sentry/views/dashboardsV2/widgetCard/widgetCardChartContainer';
import WidgetQueries from 'sentry/views/dashboardsV2/widgetCard/widgetQueries';

import {WidgetViewerQueryField} from './widgetViewerModal/utils';
import {
  renderGridBodyCell,
  renderGridHeaderCell,
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
  } = props;
  const isTableWidget = widget.displayType === DisplayType.TABLE;
  const [modalSelection, setModalSelection] = React.useState<PageFilters>(selection);
  const [cursor, setCursor] = React.useState<string>();
  const selectedQueryIndex =
    decodeInteger(location.query[WidgetViewerQueryField.QUERY]) ?? 0;

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

  const renderWidgetViewer = () => {
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

    return (
      <React.Fragment>
        {widget.queries.length > 1 && (
          <TextContainer>
            {t(
              'This widget was built with multiple queries. Table data can only be displayed for one query at a time.'
            )}
          </TextContainer>
        )}
        {widget.displayType !== DisplayType.TABLE && (
          <Container>
            <WidgetCardChartContainer
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
            />
          </Container>
        )}
        {widget.queries.length > 1 && (
          <StyledSelectControl
            value={selectedQueryIndex}
            options={queryOptions}
            onChange={(option: SelectValue<number>) =>
              router.replace({
                pathname: location.pathname,
                query: {...location.query, [WidgetViewerQueryField.QUERY]: option.value},
              })
            }
          />
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
            >
              {({transformedResults, loading}) => {
                return (
                  <GridEditable
                    isLoading={loading}
                    data={transformedResults}
                    columnOrder={columnOrder}
                    columnSortBy={columnSortBy}
                    grid={{
                      renderHeadCell: renderGridHeaderCell({
                        ...props,
                      }) as (
                        column: GridColumnOrder,
                        columnIndex: number
                      ) => React.ReactNode,
                      renderBodyCell: renderGridBodyCell({
                        ...props,
                      }),
                    }}
                    location={location}
                  />
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
                        renderHeadCell: renderGridHeaderCell({
                          ...props,
                          widget: tableWidget,
                          tableData: tableResults?.[0],
                        }) as (
                          column: GridColumnOrder,
                          columnIndex: number
                        ) => React.ReactNode,
                        renderBodyCell: renderGridBodyCell({
                          ...props,
                          widget: tableWidget,
                          tableData: tableResults?.[0],
                          isFirstPage,
                        }),
                      }}
                      location={location}
                    />
                    <StyledPagination
                      pageLinks={pageLinks}
                      onCursor={newCursor => {
                        setCursor(newCursor);
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
  };

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
        primaryWidget,
        modalSelection,
        organization,
        selectedQueryIndex
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
`;
const footerCss = css`
  margin: 0px -${space(4)} -${space(4)};
`;

const Container = styled('div')`
  height: 300px;
  max-height: 300px;
  position: relative;

  & > div {
    padding: 10px 0px;
  }
`;

const TextContainer = styled('div')`
  padding-top: 10px;
`;

const StyledSelectControl = styled(SelectControl)`
  padding-top: 10px;
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
