import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {emptyCellStyle, Table} from '@sentry/scraps/table';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';

export const TableEmpty = styled(Table.Status)`
  ${emptyCellStyle}
`;

export function TableLoading(props: ComponentProps<typeof TableEmpty>) {
  return (
    <TableEmpty {...props}>
      <LoadingIndicator />
    </TableEmpty>
  );
}

export function TableError(props: ComponentProps<typeof LoadingError>) {
  return (
    <TableEmpty>
      <LoadingError {...props} />
    </TableEmpty>
  );
}
