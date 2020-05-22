import React from 'react';
import {Location, LocationDescriptorObject} from 'history';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import space from 'app/styles/space';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import Pagination from 'app/components/pagination';
import Link from 'app/components/links/link';
import EventView, {EventData, isFieldSortable} from 'app/utils/discover/eventView';
import {TableData, TableDataRow, TableColumn} from 'app/views/eventsV2/table/types';
import GridEditable, {COL_WIDTH_UNDEFINED, GridColumn} from 'app/components/gridEditable';
import SortLink from 'app/components/gridEditable/sortLink';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import {decodeScalar} from 'app/utils/queryString';
import SearchBar from 'app/components/searchBar';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';

import {transactionSummaryRouteWithQuery} from './transactionSummary/utils';
import {COLUMN_TITLES} from './data';

export function getProjectID(
  eventData: EventData,
  projects: Project[]
): string | undefined {
  const projectSlug = (eventData?.project as string) || undefined;

  if (typeof projectSlug === undefined) {
    return undefined;
  }

  const project = projects.find(currentProject => currentProject.slug === projectSlug);

  if (!project) {
    return undefined;
  }

  return project.id;
}

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  setError: (msg: string | undefined) => void;
  keyTransactions: boolean;

  projects: Project[];
};

type State = {
  widths: number[];
};

class Table extends React.Component<Props, State> {
  state = {
    widths: [],
  };

  renderBodyCell = (tableMeta: TableData['meta']) => {
    const {eventView, organization, projects, location} = this.props;

    return (
      column: TableColumn<keyof TableDataRow>,
      dataRow: TableDataRow
    ): React.ReactNode => {
      if (!tableMeta) {
        return null;
      }
      const field = String(column.key);
      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(dataRow, {organization, location});

      if (field === 'transaction') {
        const projectID = getProjectID(dataRow, projects);

        const query = eventView.generateQueryStringObject();
        const target = transactionSummaryRouteWithQuery({
          orgSlug: organization.slug,
          transaction: String(dataRow.transaction) || '',
          projectID,
          query,
        });

        rendered = (
          <Link to={target} onClick={this.handleSummaryClick}>
            {rendered}
          </Link>
        );
      }

      return rendered;
    };
  };

  renderHeadCell = (tableMeta: TableData['meta']) => {
    const {eventView, location} = this.props;

    return (column: TableColumn<keyof TableDataRow>, index: number): React.ReactNode => {
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
                query: {...location.query, sort: queryStringObject.sort},
              };
            }
            const currentSort = eventView.sortForField(field, tableMeta);
            const canSort = isFieldSortable(field, tableMeta);

            return (
              <SortLink
                align={align}
                title={COLUMN_TITLES[index] || field.field}
                direction={currentSort ? currentSort.kind : undefined}
                canSort={canSort}
                generateSortLink={generateSortLink}
              />
            );
          }}
        </HeaderCell>
      );
    };
  };

  getTransactionSearchQuery(): string {
    const {location} = this.props;

    return String(decodeScalar(location.query.query) || '').trim();
  }

  handleSummaryClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.overview.navigate.summary',
      eventName: 'Performance Views: Overview view summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  handleTransactionSearchQuery = (searchQuery: string) => {
    const {location, organization} = this.props;

    trackAnalyticsEvent({
      eventKey: 'performance_views.overview.search',
      eventName: 'Performance Views: Transaction overview search',
      organization_id: parseInt(organization.id, 10),
    });

    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
      },
    });
  };

  handleResizeColumn = (columnIndex: number, nextColumn: GridColumn) => {
    const widths: number[] = [...this.state.widths];
    widths[columnIndex] = nextColumn.width
      ? Number(nextColumn.width)
      : COL_WIDTH_UNDEFINED;
    this.setState({widths});
  };

  render() {
    const {eventView, organization, location, keyTransactions} = this.props;
    const {widths} = this.state;
    const columnOrder = eventView
      .getColumns()
      .map((col: TableColumn<React.ReactText>, i: number) => {
        if (typeof widths[i] === 'number') {
          return {...col, width: widths[i]};
        }
        return col;
      });

    const columnSortBy = eventView.getSorts();
    const filterString = this.getTransactionSearchQuery();
    return (
      <div>
        <StyledSearchBar
          query={filterString}
          placeholder={t('Filter Transactions')}
          onSearch={this.handleTransactionSearchQuery}
        />
        <DiscoverQuery
          eventView={eventView}
          orgSlug={organization.slug}
          location={location}
          keyTransactions={keyTransactions}
        >
          {({pageLinks, isLoading, tableData}) => (
            <React.Fragment>
              <GridEditable
                isLoading={isLoading}
                data={tableData ? tableData.data : []}
                columnOrder={columnOrder}
                columnSortBy={columnSortBy}
                grid={{
                  onResizeColumn: this.handleResizeColumn,
                  renderHeadCell: this.renderHeadCell(tableData?.meta) as any,
                  renderBodyCell: this.renderBodyCell(tableData?.meta) as any,
                }}
                location={location}
              />
              <Pagination pageLinks={pageLinks} />
            </React.Fragment>
          )}
        </DiscoverQuery>
      </div>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;

  margin-bottom: ${space(1)};
`;

export default Table;
