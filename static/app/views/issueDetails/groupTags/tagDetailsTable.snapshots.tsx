import {MemoryRouter} from 'react-router';

import {Container, ContainerQueryContext} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {TagDetailsTable} from './tagDetailsTable';

describe('TagDetailsTable', () => {
  describe.each([
    {viewport: 400, breakpoint: '2xs'},
    {viewport: 480, breakpoint: 'xs'},
    {viewport: 800, breakpoint: 'xl'},
  ] as const)('container width $viewport', ({viewport, breakpoint}) => {
    it.snapshot(
      'column visibility',
      () => (
        <MemoryRouter>
          <Text as="div">
            <Container containerType="inline-size" background="primary">
              {/* SSR does not run the container measurement effect. */}
              <ContainerQueryContext value={breakpoint}>
                <TagDetailsTable sort="count" getSortLocation={() => '/tags/'}>
                  {[
                    {value: 'user@example.com', count: 75, share: '75%'},
                    {value: 'another@example.com', count: 25, share: '25%'},
                  ].map(row => (
                    <SimpleTable.Row key={row.value}>
                      <SimpleTable.RowCell>{row.value}</SimpleTable.RowCell>
                      <SimpleTable.RowCell>
                        <Text ellipsis variant="inherit">
                          2 hours ago
                        </Text>
                      </SimpleTable.RowCell>
                      <SimpleTable.RowCell justify="end">{row.count}</SimpleTable.RowCell>
                      <SimpleTable.RowCell justify="end">{row.share}</SimpleTable.RowCell>
                      <SimpleTable.RowCell />
                    </SimpleTable.Row>
                  ))}
                </TagDetailsTable>
              </ContainerQueryContext>
            </Container>
          </Text>
        </MemoryRouter>
      ),
      {viewport, tags: {area: 'core'}}
    );
  });
});
