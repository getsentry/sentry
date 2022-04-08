import * as React from 'react';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelTable from 'sentry/components/panels/panelTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  Alignments,
  fieldAlignment,
  getAggregateAlias,
} from 'sentry/utils/discover/fields';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import CellAction, {Actions} from 'sentry/views/eventsV2/table/cellAction';
import {TableColumn} from 'sentry/views/eventsV2/table/types';
import {GridCell, GridCellNumber} from 'sentry/views/performance/styles';
import {TrendsDataEvents} from 'sentry/views/performance/trends/types';

type Props = {
  columnOrder: TableColumn<React.ReactText>[];
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  tableData: TableData | TrendsDataEvents | null;
  generateLink?: Record<
    string,
    (
      organization: Organization,
      tableRow: TableDataRow,
      query: Query
    ) => LocationDescriptor
  >;
  handleCellAction?: (
    c: TableColumn<React.ReactText>
  ) => (a: Actions, v: React.ReactText) => void;
  titles?: string[];
};

class TransactionsTable extends React.PureComponent<Props> {
  getTitles() {
    const {eventView, titles} = this.props;
    return titles ?? eventView.getFields();
  }

  renderHeader() {
    const {tableData, columnOrder} = this.props;

    const tableMeta = tableData?.meta;
    const generateSortLink = () => undefined;
    const tableTitles = this.getTitles();

    const headers = tableTitles.map((title, index) => {
      const column = columnOrder[index];
      const align: Alignments = fieldAlignment(column.name, column.type, tableMeta);

      if (column.key === 'span_ops_breakdown.relative') {
        return (
          <HeadCellContainer key={index}>
            <GuideAnchor target="span_op_relative_breakdowns">
              <SortLink
                align={align}
                title={
                  title === t('operation duration') ? (
                    <React.Fragment>
                      {title}
                      <StyledIconQuestion
                        size="xs"
                        position="top"
                        title={t(
                          `Span durations are summed over the course of an entire transaction. Any overlapping spans are only counted once.`
                        )}
                      />
                    </React.Fragment>
                  ) : (
                    title
                  )
                }
                direction={undefined}
                canSort={false}
                generateSortLink={generateSortLink}
              />
            </GuideAnchor>
          </HeadCellContainer>
        );
      }

      return (
        <HeadCellContainer key={index}>
          <SortLink
            align={align}
            title={title}
            direction={undefined}
            canSort={false}
            generateSortLink={generateSortLink}
          />
        </HeadCellContainer>
      );
    });

    return headers;
  }

  renderRow(
    row: TableDataRow,
    rowIndex: number,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ): React.ReactNode[] {
    const {eventView, organization, location, generateLink, handleCellAction, titles} =
      this.props;
    const fields = eventView.getFields();

    if (titles && titles.length) {
      // Slice to match length of given titles
      columnOrder = columnOrder.slice(0, titles.length);
    }

    const resultsRow = columnOrder.map((column, index) => {
      const field = String(column.key);
      // TODO add a better abstraction for this in fieldRenderers.
      const fieldName = getAggregateAlias(field);
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(row, {organization, location});

      const target = generateLink?.[field]?.(organization, row, location.query);

      if (target) {
        rendered = (
          <Link data-test-id={`view-${fields[index]}`} to={target}>
            {rendered}
          </Link>
        );
      }

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      const key = `${rowIndex}:${column.key}:${index}`;
      rendered = isNumeric ? (
        <GridCellNumber>{rendered}</GridCellNumber>
      ) : (
        <GridCell>{rendered}</GridCell>
      );

      if (handleCellAction) {
        rendered = (
          <CellAction
            column={column}
            dataRow={row}
            handleCellAction={handleCellAction(column)}
          >
            {rendered}
          </CellAction>
        );
      }

      return <BodyCellContainer key={key}>{rendered}</BodyCellContainer>;
    });

    return resultsRow;
  }

  renderResults() {
    const {isLoading, tableData, columnOrder} = this.props;
    let cells: React.ReactNode[] = [];

    if (isLoading) {
      return cells;
    }
    if (!tableData || !tableData.meta || !tableData.data) {
      return cells;
    }

    tableData.data.forEach((row, i: number) => {
      // Another check to appease tsc
      if (!tableData.meta) {
        return;
      }
      cells = cells.concat(this.renderRow(row, i, columnOrder, tableData.meta));
    });
    return cells;
  }

  render() {
    const {isLoading, tableData} = this.props;

    const hasResults =
      tableData && tableData.data && tableData.meta && tableData.data.length > 0;

    // Custom set the height so we don't have layout shift when results are loaded.
    const loader = <LoadingIndicator style={{margin: '70px auto'}} />;

    return (
      <VisuallyCompleteWithData id="TransactionsTable" hasData={hasResults}>
        <PanelTable
          data-test-id="transactions-table"
          isEmpty={!hasResults}
          emptyMessage={t('No transactions found')}
          headers={this.renderHeader()}
          isLoading={isLoading}
          disablePadding
          loader={loader}
        >
          {this.renderResults()}
        </PanelTable>
      </VisuallyCompleteWithData>
    );
  }
}

const HeadCellContainer = styled('div')`
  padding: ${space(2)};
`;

const BodyCellContainer = styled('div')`
  padding: ${space(1)} ${space(2)};
  ${overflowEllipsis};
`;

const StyledIconQuestion = styled(QuestionTooltip)`
  position: relative;
  top: 1px;
  left: 4px;
`;

export default TransactionsTable;
