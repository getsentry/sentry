import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import space from 'app/styles/space';
import {assert} from 'app/types/utils';
import {t} from 'app/locale';
import Button from 'app/components/button';
import {Panel} from 'app/components/panels';
import LoadingIndicator from 'app/components/loadingIndicator';
import Link from 'app/components/links/link';
import {TableData, TableDataRow, TableColumn} from 'app/views/eventsV2/table/types';
import HeaderCell from 'app/views/eventsV2/table/headerCell';
import SortLink from 'app/views/eventsV2/sortLink';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventView, {MetaType} from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {generateEventSlug, eventDetailsRouteWithEventView} from 'app/utils/discover/urls';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import {trackAnalyticsEvent} from 'app/utils/analytics';

import {
  TableGrid,
  GridHead,
  GridBody,
  GridHeadCell,
  GridBodyCell,
  GridBodyCellNumber,
  SummaryGridRow,
} from '../styles';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;

  isLoading: boolean;
  tableData: TableData | null | undefined;
};

class SummaryContentTable extends React.Component<Props> {
  handleDiscoverViewClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.view_in_discover',
      eventName: 'Performance Views: View in Discover from Transaction Summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  handleViewDetailsClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.view_details',
      eventName: 'Performance Views: View Details from Transaction Summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  renderHeader() {
    const {eventView, tableData} = this.props;

    const tableDataMeta = tableData && tableData.meta ? tableData.meta : undefined;
    const columnOrder = eventView.getColumns();
    const generateSortLink = () => undefined;

    return columnOrder.map((column, index) => (
      <HeaderCell column={column} tableData={tableData} key={index}>
        {({align}) => {
          const field = {field: column.name, width: column.width};

          return (
            <GridHeadCell>
              <SortLink
                align={align}
                field={field}
                eventView={eventView}
                tableDataMeta={tableDataMeta}
                generateSortLink={generateSortLink}
              />
            </GridHeadCell>
          );
        }}
      </HeaderCell>
    ));
  }

  renderResults() {
    const {isLoading, tableData} = this.props;

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
        <SummaryGridRow key={index}>
          {this.renderRowItem(row, columnOrder, tableData.meta)}
        </SummaryGridRow>
      );
    });
  }

  renderRowItem(
    row: TableDataRow,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ) {
    const {organization, location, eventView} = this.props;

    return columnOrder.map((column, index) => {
      const field = String(column.key);
      // TODO add a better abstraction for this in fieldRenderers.
      const fieldName = getAggregateAlias(field);
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(row, {organization, location});

      const isFirstCell = index === 0;

      if (isFirstCell) {
        // the first column of the row should link to the transaction details view
        // on Discover

        const eventSlug = generateEventSlug(row);

        const target = eventDetailsRouteWithEventView({
          orgSlug: organization.slug,
          eventSlug,
          eventView,
        });

        rendered = (
          <Link to={target} onClick={this.handleViewDetailsClick}>
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

  render() {
    const {eventView, organization} = this.props;

    let title = t('Slowest Requests');
    const parsed = tokenizeSearch(eventView.query);
    if (parsed['transaction.duration']) {
      title = t('Requests %s and %s in duration', ...parsed['transaction.duration']);
    }

    return (
      <React.Fragment>
        <Header>
          <HeaderTitle>{title}</HeaderTitle>
          <HeaderButtonContainer>
            <Button
              onClick={this.handleDiscoverViewClick}
              to={eventView.getResultsViewUrlTarget(organization.slug)}
              size="small"
            >
              {t('Open in Discover')}
            </Button>
          </HeaderButtonContainer>
        </Header>
        <Panel>
          <TableGrid>
            <GridHead>
              <SummaryGridRow>{this.renderHeader()}</SummaryGridRow>
            </GridHead>
            <GridBody>{this.renderResults()}</GridBody>
          </TableGrid>
        </Panel>
      </React.Fragment>
    );
  }
}

export const HeaderTitle = styled('h4')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray3};
`;

export const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 ${space(1)} 0;
`;

export const HeaderButtonContainer = styled('div')`
  display: flex;
  flex-direction: row;
`;

export default SummaryContentTable;
