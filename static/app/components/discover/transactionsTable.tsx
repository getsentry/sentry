import * as React from 'react';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import SortLink from 'app/components/gridEditable/sortLink';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import PanelTable from 'app/components/panels/panelTable';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView, {MetaType} from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {Alignments, fieldAlignment, getAggregateAlias} from 'app/utils/discover/fields';
import {generateEventSlug} from 'app/utils/discover/urls';
import {getDuration} from 'app/utils/formatters';
import {BaselineQueryResults} from 'app/utils/performance/baseline/baselineQuery';
import CellAction, {Actions} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';
import {GridCell, GridCellNumber} from 'app/views/performance/styles';
import {TrendsDataEvents} from 'app/views/performance/trends/types';
import {getTransactionComparisonUrl} from 'app/views/performance/utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  location: Location;
  isLoading: boolean;
  tableData: TableData | TrendsDataEvents | null;
  columnOrder: TableColumn<React.ReactText>[];
  titles?: string[];
  baselineTransactionName: string | null;
  baselineData: BaselineQueryResults | null;
  handleBaselineClick?: (e: React.MouseEvent<Element>) => void;
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
};

class TransactionsTable extends React.PureComponent<Props> {
  getTitles() {
    const {eventView, titles} = this.props;
    return titles ?? eventView.getFields();
  }

  renderHeader() {
    const {tableData, columnOrder, baselineTransactionName} = this.props;

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

    if (baselineTransactionName) {
      headers.push(
        <HeadCellContainer key="baseline">
          <SortLink
            align="right"
            title={t('Compared to Baseline')}
            direction={undefined}
            canSort={false}
            generateSortLink={generateSortLink}
          />
        </HeadCellContainer>
      );
    }

    return headers;
  }

  renderRow(
    row: TableDataRow,
    rowIndex: number,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ): React.ReactNode[] {
    const {
      eventView,
      organization,
      location,
      generateLink,
      baselineTransactionName,
      baselineData,
      handleBaselineClick,
      handleCellAction,
      titles,
    } = this.props;
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

    if (baselineTransactionName) {
      if (baselineData) {
        const currentTransactionDuration: number =
          Number(row['transaction.duration']) || 0;
        const duration = baselineData['transaction.duration'];

        const delta = Math.abs(currentTransactionDuration - duration);

        const relativeSpeed =
          currentTransactionDuration < duration
            ? t('faster')
            : currentTransactionDuration > duration
            ? t('slower')
            : '';

        const target = getTransactionComparisonUrl({
          organization,
          baselineEventSlug: generateEventSlug(baselineData),
          regressionEventSlug: generateEventSlug(row),
          transaction: baselineTransactionName,
          query: location.query,
        });

        resultsRow.push(
          <BodyCellContainer
            data-test-id="baseline-cell"
            key={`${rowIndex}-baseline`}
            style={{textAlign: 'right'}}
          >
            <GridCell>
              <Link to={target} onClick={handleBaselineClick}>
                {`${getDuration(delta / 1000, delta < 1000 ? 0 : 2)} ${relativeSpeed}`}
              </Link>
            </GridCell>
          </BodyCellContainer>
        );
      } else {
        resultsRow.push(
          <BodyCellContainer data-test-id="baseline-cell" key={`${rowIndex}-baseline`}>
            {'\u2014'}
          </BodyCellContainer>
        );
      }
    }

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
      <PanelTable
        isEmpty={!hasResults}
        emptyMessage={t('No transactions found')}
        headers={this.renderHeader()}
        isLoading={isLoading}
        disablePadding
        loader={loader}
      >
        {this.renderResults()}
      </PanelTable>
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
