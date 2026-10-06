import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

/**
 * @deprecated Use `Table` from `@sentry/scraps/table`.
 */
export const Table = styled(SimpleTable)`
  overflow-x: hidden;
  margin: 0;

  table {
    overflow-y: auto;
  }
`;
