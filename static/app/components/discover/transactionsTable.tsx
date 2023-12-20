import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';

import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelTable from 'sentry/components/panels/panelTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {objectIsEmpty} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import EventView, {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  Alignments,
  fieldAlignment,
  getAggregateAlias,
} from 'sentry/utils/discover/fields';
import ViewReplayLink from 'sentry/utils/discover/viewReplayLink';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import CellAction, {Actions} from 'sentry/views/discover/table/cellAction';
import {TableColumn} from 'sentry/views/discover/table/types';
import {GridCell, GridCellNumber} from 'sentry/views/performance/styles';
import {TrendsDataEvents} from 'sentry/views/performance/trends/types';

type Props = {
  columnOrder: TableColumn<React.ReactText>[];
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  tableData: TableData | TrendsDataEvents | null;
  useAggregateAlias: boolean;
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
  referrer?: string;
  titles?: string[];
};

class TransactionsTable extends PureComponent<Props> {
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
            <SortLink
              align={align}
              title={
                title === t('operation duration') ? (
                  <Fragment>
                    {title}
                    <StyledIconQuestion
                      size="xs"
                      position="top"
                      title={t(
                        `Span durations are summed over the course of an entire transaction. Any overlapping spans are only counted once.`
                      )}
                    />
                  </Fragment>
                ) : (
                  title
                )
              }
              direction={undefined}
              canSort={false}
              generateSortLink={generateSortLink}
            />
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
    const {
      eventView,
      organization,
      location,
      generateLink,
      handleCellAction,
      titles,
      useAggregateAlias,
      referrer,
    } = this.props;
    const fields = eventView.getFields();

    if (titles && titles.length) {
      // Slice to match length of given titles
      columnOrder = columnOrder.slice(0, titles.length);
    }

    const resultsRow = columnOrder.map((column, index) => {
      const field = String(column.key);
      // TODO add a better abstraction for this in fieldRenderers.
      const fieldName = useAggregateAlias ? getAggregateAlias(field) : field;
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta, useAggregateAlias);
      let rendered = fieldRenderer(row, {organization, location});

      const target = generateLink?.[field]?.(organization, row, location.query);

      if (target && !objectIsEmpty(target)) {
        if (fields[index] === 'replayId') {
          rendered = (
            <ViewReplayLink replayId={row.replayId} to={target}>
              {rendered}
            </ViewReplayLink>
          );
        } else if (fields[index] === 'profile.id') {
          rendered = (
            <Link
              data-test-id={`view-${fields[index]}`}
              to={target}
              onClick={getProfileAnalyticsHandler(organization, referrer)}
            >
              {rendered}
            </Link>
          );
        } else {
          rendered = (
            <Link data-test-id={`view-${fields[index]}`} to={target}>
              {rendered}
            </Link>
          );
        }
      }

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      const key = `${rowIndex}:${column.key}:${index}`;
      rendered = isNumeric ? (
        <GridCellNumber data-test-id="grid-cell">{rendered}</GridCellNumber>
      ) : (
        <GridCell data-test-id="grid-cell">{rendered}</GridCell>
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
      <VisuallyCompleteWithData
        id="TransactionsTable"
        hasData={hasResults}
        isLoading={isLoading}
      >
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

function getProfileAnalyticsHandler(organization: Organization, referrer?: string) {
  return () => {
    let source;
    if (referrer === 'performance.transactions_summary') {
      source = 'performance.transactions_summary.overview';
    } else {
      source = 'discover.transactions_table';
    }
    trackAnalytics('profiling_views.go_to_flamegraph', {
      organization,
      source,
    });
  };
}

const HeadCellContainer = styled('div')`
  padding: ${space(2)};
`;

const BodyCellContainer = styled('div')`
  padding: ${space(1)} ${space(2)};
  ${p => p.theme.overflowEllipsis};
`;

const StyledIconQuestion = styled(QuestionTooltip)`
  position: relative;
  top: 1px;
  left: 4px;
`;

export default TransactionsTable;
