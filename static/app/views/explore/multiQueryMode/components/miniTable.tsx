import styled from '@emotion/styled';

import {DataTable} from 'sentry/components/tables/dataTable';

/**
 * @deprecated Use `Table` from `@sentry/scraps/table`.
 */
export const Table = styled(DataTable)`
  overflow-x: hidden;
  margin: 0;

  table {
    overflow-y: auto;
  }
`;
