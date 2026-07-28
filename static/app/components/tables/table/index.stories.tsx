import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Table, type TableColumnConfig} from 'sentry/components/tables/table';
import * as Storybook from 'sentry/stories';

interface Row {
  browser: string;
  count: number;
  transaction: string;
}

const columns: TableColumnConfig[] = [
  {key: 'transaction', width: 260},
  {key: 'browser', width: 160},
  {key: 'count'},
];

const labels: Record<string, string> = {
  browser: 'Browser',
  count: 'Count',
  transaction: 'Transaction',
};

const data: Row[] = [
  {transaction: '/api/organizations/', browser: 'Chrome', count: 1284},
  {transaction: '/api/projects/', browser: 'Firefox', count: 942},
  {transaction: '/issues/', browser: 'Safari', count: 388},
];

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
    color: ${p => p.theme.tokens.content.secondary};
    font-size: ${p => p.theme.font.size.sm};
  }

  tbody tr:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

function Demo(props: Partial<React.ComponentProps<typeof Table>>) {
  return (
    <StyledTable columns={columns} dataRows={data.length} {...props}>
      <Table.Head>
        <Table.Row>
          {columns.map(column => (
            <Table.HeadCell column={column.key} key={column.key}>
              {labels[column.key]}
            </Table.HeadCell>
          ))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {data.map(row => (
          <Table.Row key={row.transaction}>
            {columns.map(column => (
              <Table.Cell key={column.key}>{row[column.key as keyof Row]}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </StyledTable>
  );
}

export default Storybook.story('Table', story => {
  story('Overview', () => (
    <Fragment>
      <p>
        <Storybook.JSXNode name="Table" /> is the shared substrate behind the sanctioned
        table components. It owns column tracks, the resize drag, and table semantics —
        and nothing else. Every visual decision belongs to the component layered on top,
        which is why the demo below supplies its own borders and padding.
      </p>
      <p>
        Columns are declared as data because a resize needs stable identity and a known
        column count; cell contents stay as children.
      </p>
      <Demo />
    </Fragment>
  ));

  story('Resizing', () => (
    <Fragment>
      <p>
        Drag the divider between two headers to resize. Double-click a divider to restore
        that column to its automatic width. The last column has no handle — it absorbs
        slack so the row cannot underflow.
      </p>
      <p>
        Without <Storybook.JSXProperty name="onColumnResize" value /> the table keeps
        widths in its own state. Supply the callback to own them yourself and persist them
        (to the URL, for instance).
      </p>
      <Demo />
    </Fragment>
  ));

  story('Fixed columns', () => (
    <Fragment>
      <p>
        Set <Storybook.JSXProperty name="lastColumnFlexible" value={false} /> to size
        every column exactly. <Storybook.JSXProperty name="prependColumnWidths" value />{' '}
        adds gutter tracks for checkboxes or expand toggles ahead of the declared columns;
        those tracks need their own cells in each row.
      </p>
      <Demo lastColumnFlexible={false} />
    </Fragment>
  ));
});
