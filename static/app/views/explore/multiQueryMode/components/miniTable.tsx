import styled from '@emotion/styled';

import {Table as ExploreTable} from 'sentry/views/explore/components/table';

/**
 * @deprecated Use `Table` from `@sentry/scraps/table`.
 */
export const Table = styled(ExploreTable)`
  overflow-x: hidden;
  margin: 0;

  table {
    overflow-y: auto;
  }
`;
