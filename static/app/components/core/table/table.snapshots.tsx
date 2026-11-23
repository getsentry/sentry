import {Container} from '@sentry/scraps/layout';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

function ExampleTable({columns}: {columns: TableColumnConfig[]}) {
  return (
    <Text as="div">
      <Container padding="md" width="100%">
        <Table columns={columns}>
          <Table.Head>
            <Table.Row>
              {columns.map(column => (
                <Table.HeadCell key={column.key}>
                  <Container padding="md">
                    <Text bold>{column.key}</Text>
                  </Container>
                </Table.HeadCell>
              ))}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {[1, 2].map(row => (
              <Table.Row key={row}>
                {columns.map(column => (
                  <Table.Cell key={column.key}>
                    <Container padding="md" borderBottom="secondary">
                      {column.key} {row}
                    </Container>
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
            <Table.Status>
              <Container padding="md">Full-width status row</Container>
            </Table.Status>
          </Table.Body>
        </Table>
      </Container>
    </Text>
  );
}

describe('Table column visibility', () => {
  it.snapshot(
    'all columns visible',
    () => (
      <ExampleTable
        columns={[{key: 'name', width: 120}, {key: 'age', width: 150}, {key: 'count'}]}
      />
    ),
    {viewport: 400, tags: {area: 'core'}}
  );

  it.snapshot(
    'hides cells in the middle column',
    () => (
      <ExampleTable
        columns={[
          {key: 'name', width: {zero: 120, xl: 200}},
          {key: 'age', visible: {xl: true}, width: 150},
          {key: 'count'},
        ]}
      />
    ),
    {viewport: 400, tags: {area: 'core'}}
  );

  it.snapshot(
    'keeps columns declared only at wider breakpoints hidden at the base',
    () => <ExampleTable columns={[{key: 'name'}, {key: 'age', visible: {xl: true}}]} />,
    {viewport: 400, tags: {area: 'core'}}
  );

  it.snapshot(
    'keeps a full-width row visible when the first column is hidden',
    () => (
      <ExampleTable
        columns={[
          {key: 'name', visible: false, width: 120},
          {key: 'age', width: 150},
          {key: 'count'},
        ]}
      />
    ),
    {viewport: 400, tags: {area: 'core'}}
  );
});
