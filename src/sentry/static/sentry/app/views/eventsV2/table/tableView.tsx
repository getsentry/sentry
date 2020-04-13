import React from 'react';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';
import {Location, LocationDescriptorObject} from 'history';

import {Organization, OrganizationSummary} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';
import {IconEvent, IconStack} from 'app/icons';
import {t} from 'app/locale';
import {openModal} from 'app/actionCreators/modal';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import EventView, {
  MetaType,
  pickRelevantLocationQueryStrings,
} from 'app/utils/discover/eventView';
import {Column} from 'app/utils/discover/fields';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {generateEventSlug, eventDetailsRouteWithEventView} from 'app/utils/discover/urls';

import {downloadAsCsv, getExpandedResults, pushEventViewToLocation} from '../utils';
import SortLink from '../sortLink';
import ColumnEditModal, {modalCss} from './columnEditModal';
import {TableColumn, TableData, TableDataRow} from './types';
import HeaderCell from './headerCell';
import CellAction from './cellAction';

export type TableViewProps = {
  location: Location;
  organization: Organization;

  isLoading: boolean;
  error: string | null;

  eventView: EventView;
  tableData: TableData | null | undefined;
  tagKeys: null | string[];
  title: string;
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
    const {location, eventView, organization} = this.props;

    const newWidth = nextColumn.width ? Number(nextColumn.width) : COL_WIDTH_UNDEFINED;
    const nextEventView = eventView.withResizedColumn(columnIndex, newWidth);

    if (nextEventView !== eventView) {
      const changed: string[] = [];

      const prevField = eventView.fields[columnIndex];
      const nextField = nextEventView.fields[columnIndex];
      if (prevField.width !== nextField.width) {
        changed.push('width');
      }

      trackAnalyticsEvent({
        eventKey: 'discover_v2.update_column',
        eventName: 'Discoverv2: A column was updated',
        updated_at_index: columnIndex,
        changed,
        organization_id: parseInt(organization.id, 10),
      });
    }

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

    return (
      <HeaderCell column={column} tableData={tableData}>
        {({align}) => {
          const tableDataMeta = tableData && tableData.meta ? tableData.meta : undefined;

          const field = {field: column.name, width: column.width};
          function generateSortLink(): LocationDescriptorObject | undefined {
            if (!tableDataMeta) {
              return undefined;
            }

            const nextEventView = eventView.sortOnField(field, tableDataMeta);
            const queryStringObject = nextEventView.generateQueryStringObject();

            return {
              ...location,
              query: queryStringObject,
            };
          }

          return (
            <SortLink
              align={align}
              field={field}
              eventView={eventView}
              tableDataMeta={tableData && tableData.meta ? tableData.meta : undefined}
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
          {fieldRenderer(dataRow, {organization, location})}
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
      >
        {fieldRenderer(dataRow, {organization, location})}
      </CellAction>
    );
  };

  handleEditColumns = () => {
    const {organization, eventView, tagKeys} = this.props;
    this.trackEditAnalytics(organization, true);

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

  handleUpdateColumns = (columns: Column[]): void => {
    const {organization, eventView} = this.props;
    this.trackEditAnalytics(organization, false);

    const nextView = eventView.withColumns(columns);
    browserHistory.push(nextView.getResultsViewUrlTarget(organization.slug));
  };

  trackEditAnalytics(organization: Organization, isEditing: boolean) {
    if (isEditing) {
      // metrics
      trackAnalyticsEvent({
        eventKey: 'discover_v2.table.column_header.edit_mode.enter',
        eventName: 'Discoverv2: Enter column header edit mode',
        organization_id: parseInt(organization.id, 10),
      });
    } else {
      // metrics
      trackAnalyticsEvent({
        eventKey: 'discover_v2.table.column_header.edit_mode.exit',
        eventName: 'Discoverv2: Exit column header edit mode',
        organization_id: parseInt(organization.id, 10),
      });
    }
  }

  render() {
    const {isLoading, error, tableData, eventView, title, organization} = this.props;

    const columnOrder = eventView.getColumns();
    const columnSortBy = eventView.getSorts();

    return (
      <GridEditable
        editFeatures={['organizations:discover-query']}
        noEditMessage={t('Requires discover query feature.')}
        isLoading={isLoading}
        error={error}
        data={tableData ? tableData.data : []}
        columnOrder={columnOrder}
        columnSortBy={columnSortBy}
        grid={{
          renderHeadCell: this._renderGridHeaderCell as any,
          renderBodyCell: this._renderGridBodyCell as any,
          onResizeColumn: this._resizeColumn as any,
          renderPrependColumns: this._renderPrependColumns as any,
          prependColumnWidths: ['40px'],
        }}
        actions={{
          editColumns: this.handleEditColumns,
          downloadAsCsv: () => {
            trackAnalyticsEvent({
              eventKey: 'discover_v2.results.download_csv',
              eventName: 'Discoverv2: Download CSV',
              organization_id: parseInt(organization.id, 10),
            });
            downloadAsCsv(tableData, columnOrder, title);
          },
        }}
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
      <Link to={target} onClick={handleClick}>
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
      <Link to={target} onClick={handleClick}>
        {children}
      </Link>
    );
  }

  return <React.Fragment>{children}</React.Fragment>;
}

const HeaderIcon = styled('span')`
  & > svg {
    vertical-align: top;
    color: ${p => p.theme.gray3};
  }
`;

// Fudge the icon down so it is center aligned with the table contents.
const IconLink = styled(Link)`
  position: relative;
  display: inline-block;
  top: 3px;
`;

export default TableView;
