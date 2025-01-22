import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location, LocationDescriptor} from 'history';

import {LinkButton} from 'sentry/components/button';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels/panelTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Alignments} from 'sentry/utils/discover/fields';
import {fieldAlignment, getAggregateAlias} from 'sentry/utils/discover/fields';
import ViewReplayLink from 'sentry/utils/discover/viewReplayLink';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import type {Actions} from 'sentry/views/discover/table/cellAction';
import CellAction from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {GridCell, GridCellNumber} from 'sentry/views/performance/styles';
import type {TrendsDataEvents} from 'sentry/views/performance/trends/types';

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
      location: Location
    ) => LocationDescriptor
  >;
  handleCellAction?: (
    c: TableColumn<React.ReactText>
  ) => (a: Actions, v: React.ReactText) => void;
  referrer?: string;
  titles?: string[];
};

function TransactionsTable(props: Props) {
  const {
    eventView,
    titles,
    tableData,
    columnOrder,
    organization,
    location,
    generateLink,
    handleCellAction,
    useAggregateAlias,
    isLoading,
    referrer,
  } = props;

  const getTitles = () => {
    return titles ?? eventView.getFields();
  };

  const renderHeader = () => {
    const tableMeta = tableData?.meta;
    const generateSortLink = () => undefined;
    const tableTitles = getTitles();

    const headers = tableTitles.map((title, index) => {
      const column = columnOrder[index]!;
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
  };

  const renderRow = (
    row: TableDataRow,
    rowIndex: number,
    colOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ): React.ReactNode[] => {
    const fields = eventView.getFields();

    if (titles?.length) {
      // Slice to match length of given titles
      colOrder = colOrder.slice(0, titles.length);
    }

    const resultsRow = colOrder.map((column, index) => {
      const field = String(column.key);
      // TODO add a better abstraction for this in fieldRenderers.
      const fieldName = useAggregateAlias ? getAggregateAlias(field) : field;
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta, useAggregateAlias);
      let rendered = fieldRenderer(row, {organization, location});

      const target = generateLink?.[field]?.(organization, row, location);

      if (fields[index] === 'profile.id') {
        rendered = (
          <LinkButton
            data-test-id={`view-${fields[index]}`}
            disabled={!target || isEmptyObject(target)}
            to={target || {}}
            onClick={getProfileAnalyticsHandler(organization, referrer)}
            size="xs"
          >
            <IconProfiling size="xs" />
          </LinkButton>
        );
      } else if (target && !isEmptyObject(target)) {
        if (fields[index] === 'replayId') {
          rendered = (
            <ViewReplayLink replayId={row.replayId!} to={target}>
              {rendered}
            </ViewReplayLink>
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
  };

  const renderResults = () => {
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
      // @ts-ignore TS(2345): Argument of type 'TableDataRow | TrendsTransaction... Remove this comment to see the full error message
      cells = cells.concat(renderRow(row, i, columnOrder, tableData.meta));
    });
    return cells;
  };

  const hasResults = tableData?.meta && tableData.data?.length > 0;

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
        headers={renderHeader()}
        isLoading={isLoading}
        disablePadding
        loader={loader}
      >
        {renderResults()}
      </PanelTable>
    </VisuallyCompleteWithData>
  );
}

function getProfileAnalyticsHandler(organization: Organization, referrer?: string) {
  return () => {
    let source: any;
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
