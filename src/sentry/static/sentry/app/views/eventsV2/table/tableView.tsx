import React from 'react';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';
import {Location, LocationDescriptorObject} from 'history';

import {Organization, OrganizationSummary} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';
import Feature from 'app/components/acl/feature';
import DataExport, {ExportQueryType} from 'app/components/dataExport';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Hovercard from 'app/components/hovercard';
import {IconDownload, IconEdit, IconEvent, IconStack} from 'app/icons';
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
import space from 'app/styles/space';

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

          return (
            <SortLink
              align={align}
              field={field}
              eventView={eventView}
              tableDataMeta={tableMeta}
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
    const noEditMessage = t('Requires discover query feature.');
    const editFeatures = ['organizations:discover-query'];
    const renderDisabled = p => (
      <Hovercard
        body={
          <FeatureDisabled
            features={p.features}
            hideHelpToggle
            message={noEditMessage}
            featureName={noEditMessage}
          />
        }
      >
        {p.children(p)}
      </Hovercard>
    );
    return (
      <Feature
        hookName="feature-disabled:grid-editable-actions"
        renderDisabled={renderDisabled}
        features={editFeatures}
      >
        {({hasFeature}) => (
          <React.Fragment>
            {this.renderDownloadButton(hasFeature)}
            {this.renderEditButton(hasFeature)}
          </React.Fragment>
        )}
      </Feature>
    );
  };

  renderDownloadButton(canEdit: boolean) {
    const {tableData} = this.props;
    if (!tableData || (tableData.data && tableData.data.length < 50)) {
      return this.renderBrowserExportButton(canEdit);
    } else {
      return (
        <Feature
          features={['organizations:data-export']}
          renderDisabled={() => this.renderBrowserExportButton(canEdit)}
        >
          {this.renderAsyncExportButton(canEdit)}
        </Feature>
      );
    }
  }

  handleDownloadAsCsv = () => {
    const {organization, title, eventView, tableData} = this.props;
    trackAnalyticsEvent({
      eventKey: 'discover_v2.results.download_csv',
      eventName: 'Discoverv2: Download CSV',
      organization_id: parseInt(organization.id, 10),
    });
    downloadAsCsv(tableData, eventView.getColumns(), title);
  };

  renderBrowserExportButton(canEdit: boolean) {
    const disabled = this.props.isLoading || canEdit === false;
    const onClick = disabled ? undefined : this.handleDownloadAsCsv;

    return (
      <HeaderButton
        disabled={disabled}
        onClick={onClick}
        data-test-id="grid-download-csv"
      >
        <IconDownload size="xs" />
        {t('Export Page')}
      </HeaderButton>
    );
  }

  renderAsyncExportButton(canEdit: boolean) {
    const {isLoading, location} = this.props;
    const disabled = isLoading || canEdit === false;
    return (
      <HeaderDownloadButton
        payload={{
          queryType: ExportQueryType.Discover,
          queryInfo: location.query,
        }}
        disabled={disabled}
      >
        <IconDownload size="xs" />
        {t('Export All')}
      </HeaderDownloadButton>
    );
  }

  renderEditButton(canEdit: boolean) {
    const onClick = canEdit ? this.handleEditColumns : undefined;
    return (
      <HeaderButton disabled={!canEdit} onClick={onClick} data-test-id="grid-edit-enable">
        <IconEdit size="xs" />
        {t('Edit Columns')}
      </HeaderButton>
    );
  }

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
    color: ${p => p.theme.gray3};
  }
`;

// Fudge the icon down so it is center aligned with the table contents.
const IconLink = styled(Link)`
  position: relative;
  display: inline-block;
  top: 3px;
`;

const HeaderButton = styled('button')<{disabled?: boolean}>`
  display: flex;
  align-items: center;

  background: none;
  border: none;
  color: ${p => (p.disabled ? p.theme.gray6 : p.theme.gray3)};
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  font-size: ${p => p.theme.fontSizeSmall};

  padding: 0;
  margin: 0;
  outline: 0;

  > svg {
    margin-right: ${space(0.5)};
  }

  &:hover,
  &:active {
    color: ${p => (p.disabled ? p.theme.gray6 : p.theme.gray4)};
  }
`;

const HeaderDownloadButton = styled(DataExport)<{disabled: boolean}>`
  background: none;
  border: none;
  font-weight: normal;
  box-shadow: none;
  color: ${p => (p.disabled ? p.theme.gray6 : p.theme.gray3)};

  padding: 0;
  margin: 0;
  outline: 0;

  svg {
    margin-right: ${space(0.5)};
  }
  > span {
    padding: 0;
  }

  &:hover,
  &:active {
    color: ${p => (p.disabled ? p.theme.gray6 : p.theme.gray4)};
    box-shadow: none;
  }
`;

export default TableView;
