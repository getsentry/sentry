import styled from '@emotion/styled';

import {Table, type TableColumnConfig} from '@sentry/scraps/table';

interface Row {
  browser: string;
  count: number;
  transaction: string;
}

const columns: Array<TableColumnConfig & {key: keyof Row}> = [
  {key: 'transaction', width: 260},
  {key: 'browser', width: 160},
  {key: 'count'},
];

const data: Row[] = [
  {transaction: '/api/organizations/', browser: 'Chrome', count: 1284},
  {transaction: '/issues/', browser: 'Safari', count: 388},
];

export function OverviewDemo() {
  return (
    <StyledTable columns={columns}>
      <Table.Head>
        <Table.Row>
          {columns.map(column => (
            <Table.HeadCell column={column.key} key={column.key}>
              {column.key}
            </Table.HeadCell>
          ))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {data.map(row => (
          <Table.Row divider key={row.transaction}>
            {columns.map(column => (
              <Table.Cell key={column.key}>{row[column.key]}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </StyledTable>
  );
}

const StyledTable = styled(Table)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  th,
  td {
    display: flex;
    align-items: center;
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  }

  thead {
    background: ${p => p.theme.tokens.background.secondary};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  }
`;
