import React from 'react';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';
import {Location, LocationDescriptorObject} from 'history';

import {Organization, OrganizationSummary} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import {IconEvent, IconStack} from 'app/icons';
import {t} from 'app/locale';
import {openModal} from 'app/actionCreators/modal';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import EventView, {
  isFieldSortable,
  MetaType,
  pickRelevantLocationQueryStrings,
} from 'app/utils/discover/eventView';
import {Column} from 'app/utils/discover/fields';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {generateEventSlug, eventDetailsRouteWithEventView} from 'app/utils/discover/urls';

import {getExpandedResults, pushEventViewToLocation} from '../utils';
import ColumnEditModal, {modalCss} from './columnEditModal';
import {TableColumn, TableData, TableDataRow} from './types';
import HeaderCell from './headerCell';
import CellAction, {Actions} from './cellAction';
import TableActions from './tableActions';

export type TableViewProps = {
  location: Location;
  organization: Organization;

  isLoading: boolean;
  error: string | null;

  eventView: EventView;
  tableData: TableData | null | undefined;
  tagKeys: null | string[];
  title: string;

  onChangeShowTags: () => void;
  showTags: boolean;
};

/**
 * The `TableView` is marked with leading _ in its method names. It consumes
 * the EventView object given in its props to generate new EventView objects
 * for actions like resizing column.

 * The entire state of the table view (or event view) is co-located within
 * the EventView object. This object is fed from the props.
 *
 * Attempting to modify the state, and therefore, modifying the given EventView
 * object given from its props, will generate new instances of EventView objects.
 *
 * In most cases, the new EventView object differs from the previous EventView
 * object. The new EventView object is pushed to the location object.
 */
class TableView extends React.Component<TableViewProps> {
  /**
   * Updates a column on resizing
   */
  _resizeColumn = (columnIndex: number, nextColumn: TableColumn<keyof TableDataRow>) => {
    const {location, eventView} = this.props;

    const newWidth = nextColumn.width ? Number(nextColumn.width) : COL_WIDTH_UNDEFINED;
    const nextEventView = eventView.withResizedColumn(columnIndex, newWidth);

    pushEventViewToLocation({
      location,
      nextEventView,
      extraQuery: pickRelevantLocationQueryStrings(location),
    });
  };

  _renderPrependColumns = (
    isHeader: boolean,
    dataRow?: any,
    rowIndex?: number
  ): React.ReactNode[] => {
    const {organization, eventView} = this.props;
    const hasAggregates = eventView.getAggregateFields().length > 0;
    if (isHeader) {
      return [
        <HeaderIcon key="header-icon">
          {hasAggregates ? <IconStack size="sm" /> : <IconEvent size="sm" />}
        </HeaderIcon>,
      ];
    }

    const eventSlug = generateEventSlug(dataRow);

    const target = eventDetailsRouteWithEventView({
      orgSlug: organization.slug,
      eventSlug,
      eventView,
    });

    return [
      <Tooltip key={`eventlink${rowIndex}`} title={t('View Details')}>
        <IconLink to={target} data-test-id="view-events">
          {hasAggregates ? <IconStack size="sm" /> : <IconEvent size="sm" />}
        </IconLink>
      </Tooltip>,
    ];
  };

  _renderGridHeaderCell = (column: TableColumn<keyof TableDataRow>): React.ReactNode => {
    const {eventView, location, tableData} = this.props;
    const tableMeta = tableData?.meta;

    return (
      <HeaderCell column={column} tableMeta={tableMeta}>
        {({align}) => {
          const field = {field: column.name, width: column.width};
          function generateSortLink(): LocationDescriptorObject | undefined {
            if (!tableMeta) {
              return undefined;
            }

            const nextEventView = eventView.sortOnField(field, tableMeta);
            const queryStringObject = nextEventView.generateQueryStringObject();

            return {
              ...location,
              query: queryStringObject,
            };
          }
          const currentSort = eventView.sortForField(field, tableMeta);
          const canSort = isFieldSortable(field, tableMeta);

          return (
            <SortLink
              align={align}
              title={column.name}
              direction={currentSort ? currentSort.kind : undefined}
              canSort={canSort}
              generateSortLink={generateSortLink}
            />
          );
        }}
      </HeaderCell>
    );
  };

  _renderGridBodyCell = (
    column: TableColumn<keyof TableDataRow>,
    dataRow: TableDataRow
  ): React.ReactNode => {
    const {location, organization, tableData, eventView} = this.props;

    if (!tableData || !tableData.meta) {
      return dataRow[column.key];
    }
    const fieldRenderer = getFieldRenderer(String(column.key), tableData.meta);
    const aggregation =
      column.column.kind === 'function' ? column.column.function[0] : undefined;

    // Aggregation columns offer drilldown behavior
    if (aggregation) {
      return (
        <ExpandAggregateRow
          organization={organization}
          eventView={eventView}
          column={column}
          dataRow={dataRow}
          location={location}
          tableMeta={tableData.meta}
        >
          <CellAction
            organization={organization}
            eventView={eventView}
            column={column}
            dataRow={dataRow}
            tableMeta={tableData.meta}
            handleCellAction={this.handleCellAction(column)}
          >
            {fieldRenderer(dataRow, {organization, location})}
          </CellAction>
        </ExpandAggregateRow>
      );
    }

    // Scalar fields offer cell actions to build queries.
    return (
      <CellAction
        organization={organization}
        eventView={eventView}
        column={column}
        dataRow={dataRow}
        tableMeta={tableData.meta}
        handleCellAction={this.handleCellAction(column)}
      >
        {fieldRenderer(dataRow, {organization, location})}
      </CellAction>
    );
  };

  handleEditColumns = () => {
    const {organization, eventView, tagKeys} = this.props;

    openModal(
      modalProps => (
        <ColumnEditModal
          {...modalProps}
          organization={organization}
          tagKeys={tagKeys}
          columns={eventView.getColumns().map(col => col.column)}
          onApply={this.handleUpdateColumns}
        />
      ),
      {modalCss}
    );
  };

  handleCellAction = (column: TableColumn<keyof TableDataRow>) => {
    return (action: Actions, value: React.ReactText) => {
      console.log(action, value, column);
      // const {eventView, organization, tableMeta, projects, dataRow} = this.props;
    };
  };

  handleUpdateColumns = (columns: Column[]): void => {
    const {organization, eventView} = this.props;

    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.update_columns',
      eventName: 'Discoverv2: Update columns',
      organization_id: parseInt(organization.id, 10),
    });

    const nextView = eventView.withColumns(columns);
    browserHistory.push(nextView.getResultsViewUrlTarget(organization.slug));
  };

  renderHeaderButtons = () => {
    const {
      organization,
      title,
      eventView,
      isLoading,
      tableData,
      location,
      onChangeShowTags,
      showTags,
    } = this.props;

    return (
      <TableActions
        title={title}
        isLoading={isLoading}
        organization={organization}
        eventView={eventView}
        onEdit={this.handleEditColumns}
        tableData={tableData}
        location={location}
        onChangeShowTags={onChangeShowTags}
        showTags={showTags}
      />
    );
  };

  render() {
    const {isLoading, error, location, tableData, eventView} = this.props;

    const columnOrder = eventView.getColumns();
    const columnSortBy = eventView.getSorts();

    return (
      <GridEditable
        isLoading={isLoading}
        error={error}
        data={tableData ? tableData.data : []}
        columnOrder={columnOrder}
        columnSortBy={columnSortBy}
        title={t('Results')}
        grid={{
          renderHeadCell: this._renderGridHeaderCell as any,
          renderBodyCell: this._renderGridBodyCell as any,
          onResizeColumn: this._resizeColumn as any,
          renderPrependColumns: this._renderPrependColumns as any,
          prependColumnWidths: ['40px'],
        }}
        headerButtons={this.renderHeaderButtons}
        location={location}
      />
    );
  }
}

function ExpandAggregateRow(props: {
  organization: OrganizationSummary;
  children: React.ReactNode;
  eventView: EventView;
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
  location: Location;
  tableMeta: MetaType;
}) {
  const {children, column, dataRow, eventView, location, organization} = props;
  const aggregation =
    column.column.kind === 'function' ? column.column.function[0] : undefined;

  function handleClick() {
    trackAnalyticsEvent({
      eventKey: 'discover_v2.results.drilldown',
      eventName: 'Discoverv2: Click aggregate drilldown',
      organization_id: parseInt(organization.id, 10),
    });
  }

  // count(column) drilldown
  if (aggregation === 'count') {
    const nextView = getExpandedResults(eventView, {}, dataRow);

    const target = {
      pathname: location.pathname,
      query: nextView.generateQueryStringObject(),
    };

    return (
      <Link data-test-id="expand-count" to={target} onClick={handleClick}>
        {children}
      </Link>
    );
  }

  // count_unique(column) drilldown
  if (aggregation === 'count_unique') {
    // Drilldown into each distinct value and get a count() for each value.
    const nextView = getExpandedResults(eventView, {}, dataRow).withNewColumn({
      kind: 'function',
      function: ['count', '', undefined],
    });

    const target = {
      pathname: location.pathname,
      query: nextView.generateQueryStringObject(),
    };

    return (
      <Link data-test-id="expand-count-unique" to={target} onClick={handleClick}>
        {children}
      </Link>
    );
  }

  return <React.Fragment>{children}</React.Fragment>;
}

const HeaderIcon = styled('span')`
  & > svg {
    vertical-align: top;
    color: ${p => p.theme.gray600};
  }
`;

// Fudge the icon down so it is center aligned with the table contents.
const IconLink = styled(Link)`
  position: relative;
  display: inline-block;
  top: 3px;
`;

export default TableView;
