import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location, LocationDescriptor} from 'history';

import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {TableData, TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventView} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {fieldAlignment, getAggregateAlias} from 'sentry/utils/discover/fields';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {GridCell, GridCellNumber} from 'sentry/views/performance/styles';
import type {TrendsDataEvents} from 'sentry/views/performance/trends/types';

type Props = {
  columnOrder: Array<TableColumn<string | number>>;
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
  titles?: string[];
};

type TransactionsTableResultsProps = Pick<
  Props,
  | 'columnOrder'
  | 'eventView'
  | 'generateLink'
  | 'isLoading'
  | 'location'
  | 'organization'
  | 'tableData'
  | 'titles'
  | 'useAggregateAlias'
>;

function TransactionsTableResults({
  eventView,
  tableData,
  columnOrder,
  organization,
  location,
  generateLink,
  useAggregateAlias,
  isLoading,
  titles,
}: TransactionsTableResultsProps) {
  const navigate = useNavigate();
  const theme = useTheme();

  if (isLoading) {
    return null;
  }

  const tableMeta = tableData?.meta;
  const data = tableData?.data;
  if (!tableMeta || !data) {
    return null;
  }

  const rows: React.ReactNode[] = [];
  const fields = eventView.getFields();
  const colOrder = titles?.length ? columnOrder.slice(0, titles.length) : columnOrder;

  data.forEach((row, rowIndex: number) => {
    const tableRow = row as TableDataRow;

    const resultsRow = colOrder.map((column, index) => {
      const field = String(column.key);
      // TODO add a better abstraction for this in fieldRenderers.
      const fieldName = useAggregateAlias ? getAggregateAlias(field) : field;
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta, useAggregateAlias);
      let rendered = fieldRenderer(tableRow, {
        navigate,
        organization,
        location,
        theme,
      });

      const target = generateLink?.[field]?.(organization, tableRow, location);
      const isEmptyTarget =
        typeof target === 'object' && target !== null && isEmptyObject(target);

      if (target && !isEmptyTarget) {
        rendered = (
          <Link data-test-id={`view-${fields[index]}`} to={target}>
            {rendered}
          </Link>
        );
      }

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      const key = `${rowIndex}:${column.key}:${index}`;
      rendered = isNumeric ? (
        <GridCellNumber data-test-id="grid-cell">{rendered}</GridCellNumber>
      ) : (
        <GridCell data-test-id="grid-cell">{rendered}</GridCell>
      );

      return <BodyCellContainer key={key}>{rendered}</BodyCellContainer>;
    });

    rows.push(<SimpleTable.Row key={rowIndex}>{resultsRow}</SimpleTable.Row>);
  });

  return <Fragment>{rows}</Fragment>;
}

export function TransactionsTable(props: Props) {
  const {
    eventView,
    titles,
    tableData,
    columnOrder,
    organization,
    location,
    generateLink,
    useAggregateAlias,
    isLoading,
  } = props;
  const getTitles = () => {
    return titles ?? eventView.getFields();
  };

  const columnCount = (titles ?? eventView.getFields()).length;
  const columns = useMemo<TableColumnConfig[]>(
    () =>
      Array.from({length: columnCount}, (_, index) => ({
        key: String(index),
        width: 'auto',
      })),
    [columnCount]
  );

  const renderHeader = () => {
    const tableMeta = tableData?.meta;
    const tableTitles = getTitles();

    const headers = tableTitles.map((title, index) => {
      const column = columnOrder[index]!;
      const align = fieldAlignment(column.name, column.type, tableMeta);

      return (
        <SimpleTable.HeaderCell align={align} key={index}>
          {title}
        </SimpleTable.HeaderCell>
      );
    });

    return headers;
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
      <SimpleTable
        data-test-id="transactions-table"
        columns={columns}
        header={<SimpleTable.HeaderRow>{renderHeader()}</SimpleTable.HeaderRow>}
      >
        {isLoading && <SimpleTable.Empty>{loader}</SimpleTable.Empty>}
        {!isLoading && !hasResults && (
          <SimpleTable.Empty>
            {eventView.query
              ? t('No transactions found for this filter.')
              : t('No transactions found.')}
          </SimpleTable.Empty>
        )}
        <TransactionsTableResults
          columnOrder={columnOrder}
          eventView={eventView}
          generateLink={generateLink}
          isLoading={isLoading}
          location={location}
          organization={organization}
          tableData={tableData}
          titles={titles}
          useAggregateAlias={useAggregateAlias}
        />
      </SimpleTable>
    </VisuallyCompleteWithData>
  );
}

const BodyCellContainer = styled(SimpleTable.RowCell)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
