import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  type ColumnAlign,
  SortableHeaderCell,
} from 'sentry/components/tables/sortableHeaderCell';

describe('SortableHeaderCell', () => {
  it.snapshot.each<ColumnAlign>(['left', 'center', 'right'])(
    '%s aligned labels',
    align => (
      <Text as="div">
        <Stack gap="lg" padding="md" width="240px">
          <Container border="primary" padding="md">
            <SortableHeaderCell align={align}>Duration</SortableHeaderCell>
          </Container>
          <Container border="primary" padding="md">
            <SortableHeaderCell align={align} direction="asc">
              Duration
            </SortableHeaderCell>
          </Container>
          <Container border="primary" padding="md">
            <SortableHeaderCell align={align} direction="desc">
              Duration
            </SortableHeaderCell>
          </Container>
        </Stack>
      </Text>
    ),
    align => ({tags: {align, area: 'core'}})
  );
});
