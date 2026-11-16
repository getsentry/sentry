import type {ComponentProps} from 'react';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

function ExampleTable(
  props: Pick<ComponentProps<typeof SimpleTable>, 'density' | 'maxHeight' | 'scrollable'>
) {
  return (
    <Text as="div">
      <Container padding="md" width="480px">
        <SimpleTable
          columns={[
            {key: 'name', width: '1fr'},
            {key: 'count', width: '1fr'},
          ]}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell align="center">Name</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell align="right">Count</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
          {...props}
        >
          {Array.from({length: 6}, (_, index) => (
            <SimpleTable.Row key={index}>
              <SimpleTable.RowCell>Item {index + 1}</SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">{index + 1}</SimpleTable.RowCell>
            </SimpleTable.Row>
          ))}
        </SimpleTable>
      </Container>
    </Text>
  );
}

describe('SimpleTable', () => {
  it.snapshot.each(['default', 'compressed', 'comfortable'] as const)(
    '%s density',
    density => <ExampleTable density={density} />,
    density => ({tags: {density, area: 'core'}})
  );

  it.snapshot('scrollable with capped height', () => (
    <ExampleTable scrollable maxHeight="200px" />
  ));

  it.snapshot('clipped with capped height', () => <ExampleTable maxHeight="200px" />);
});
