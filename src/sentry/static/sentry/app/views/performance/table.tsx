import React from 'react';
import {Location, LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';

import space from 'app/styles/space';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {assert} from 'app/types/utils';
import {Panel} from 'app/components/panels';
import LoadingIndicator from 'app/components/loadingIndicator';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import Link from 'app/components/links/link';
import EventView, {MetaType, EventData} from 'app/utils/discover/eventView';
import SortLink from 'app/views/eventsV2/sortLink';
import {TableDataRow, TableColumn} from 'app/views/eventsV2/table/types';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import {decodeScalar} from 'app/views/eventsV2/utils';
import withProjects from 'app/utils/withProjects';
import SearchBar from 'app/components/searchBar';
import EventsV2 from 'app/utils/discover/eventsv2';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';

import {transactionSummaryRouteWithEventView} from './transactionSummary/utils';
import {
  TableGrid,
  GridHead,
  GridRow,
  GridBody,
  GridHeadCell,
  GridBodyCell,
  GridBodyCellNumber,
} from './styles';

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
  loadingProjects: boolean;
};

class Table extends React.Component<Props> {
  renderResults({isLoading, tableData}) {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={8}>
            <LoadingIndicator />
          </td>
        </tr>
      );
    }

    const hasResults =
      tableData && tableData.data && tableData.meta && tableData.data.length > 0;

    if (!hasResults) {
      return (
        <tr>
          <td colSpan={8}>
            <EmptyStateWarning>
              <p>{t('No transactions found')}</p>
            </EmptyStateWarning>
          </td>
        </tr>
      );
    }

    assert(tableData);

    const columnOrder = this.props.eventView.getColumns();

    return tableData.data.map((row, index) => {
      assert(tableData.meta);

      return (
        <GridRow key={index} numOfColumns={columnOrder.length}>
          {this.renderRowItem(row, columnOrder, tableData.meta)}
        </GridRow>
      );
    });
  }

  renderRowItem(
    row: TableDataRow,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ) {
    const {organization, location, projects} = this.props;

    return columnOrder.map((column, index) => {
      const field = String(column.key);
      // TODO(mark) add a better abstraction for this.
      const fieldName = getAggregateAlias(field);
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(row, {organization, location});

      const isFirstCell = index === 0;

      if (isFirstCell) {
        // the first column of the row should link to the transaction details view
        // on Discover

        const projectID = getProjectID(row, projects);

        const target = transactionSummaryRouteWithEventView({
          orgSlug: organization.slug,
          transaction: String(row.transaction) || '',
          projectID,
        });

        rendered = (
          <Link to={target} onClick={this.handleSummaryClick}>
            {rendered}
          </Link>
        );
      }

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      if (isNumeric) {
        return <GridBodyCellNumber key={column.key}>{rendered}</GridBodyCellNumber>;
      }

      return <GridBodyCell key={column.key}>{rendered}</GridBodyCell>;
    });
  }

  renderHeader({tableData}) {
    const {location, eventView, organization} = this.props;

    const tableDataMeta = tableData && tableData.meta ? tableData.meta : undefined;

    return eventView.getColumns().map((column, index) => (
      <HeaderCell column={column} tableData={tableData} key={index}>
        {({align}) => {
          const field = eventView.fields[index];

          function generateSortLink(): LocationDescriptorObject | undefined {
            if (!tableDataMeta) {
              return undefined;
            }

            const nextEventView = eventView.sortOnField(field, tableDataMeta);
            const queryStringObject = nextEventView.generateQueryStringObject();

            const omitKeys = ['widths', 'query', 'name', 'field'];

            return {
              ...location,
              query: omit(queryStringObject, omitKeys),
            };
          }

          function handleClick() {
            trackAnalyticsEvent({
              eventKey: 'performance_views.overview.sort',
              eventName: 'Performance Views: Sort Overview',
              organization_id: parseInt(organization.id, 10),
              field: field.field,
            });
          }

          return (
            <GridHeadCell>
              <SortLink
                align={align}
                field={field}
                eventView={eventView}
                tableDataMeta={tableDataMeta}
                generateSortLink={generateSortLink}
                onClick={handleClick}
              />
            </GridHeadCell>
          );
        }}
      </HeaderCell>
    ));
  }

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

  render() {
    const {eventView, organization, location, keyTransactions} = this.props;
    const columnOrder = eventView.getColumns();

    return (
      <EventsV2
        eventView={eventView}
        organization={organization}
        location={location}
        keyTransactions={keyTransactions}
      >
        {({pageLinks, isLoading, tableData}) => (
          <div>
            <StyledSearchBar
              query={this.getTransactionSearchQuery()}
              placeholder={t('Filter Transactions')}
              onSearch={this.handleTransactionSearchQuery}
            />
            <Panel>
              <TableGrid>
                <GridHead>
                  <GridRow numOfColumns={columnOrder.length}>
                    {this.renderHeader({tableData})}
                  </GridRow>
                </GridHead>
                <GridBody>{this.renderResults({isLoading, tableData})}</GridBody>
              </TableGrid>
            </Panel>
            <Pagination pageLinks={pageLinks} />
          </div>
        )}
      </EventsV2>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;

  margin-bottom: ${space(1)};
`;

export default withProjects(Table);
