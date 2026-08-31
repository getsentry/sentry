import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

export const BuildsTableGrid = styled(SimpleTable)`
  overflow: auto;
`;

export function buildsTableColumns(
  columns: TableColumnConfig[],
  showProjectColumn: boolean
) {
  return showProjectColumn ? columns : columns.filter(column => column.key !== 'project');
}

export const FullRowLink = styled(Link)`
  cursor: pointer;
  color: inherit;

  &:hover {
    color: inherit;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
  }
`;
