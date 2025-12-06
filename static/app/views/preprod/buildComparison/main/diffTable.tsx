/** Various shared components for diff tables */

import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {DiffType} from 'sentry/views/preprod/types/appSizeTypes';

export const ITEMS_PER_PAGE = 40;

export type DiffTableSort = {
  field: string;
  kind: 'asc' | 'desc';
};

export const DiffTableWithColumns = styled(SimpleTable)<{
  gridTemplateColumns: string;
}>`
  overflow-x: auto;
  overflow-y: auto;
  grid-template-columns: ${p => p.gridTemplateColumns};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  border-left: 0px;
  border-right: 0px;
`;

export const DiffTableHeader = styled(SimpleTable.Header)`
  border-radius: 0;
  border-left: 0px;
  border-right: 0px;
`;

export const DiffTableChangeAmountCell = styled(SimpleTable.RowCell)<{
  changeType: DiffType;
}>`
  align-items: end;
  color: ${p => {
    switch (p.changeType) {
      case 'increased':
      case 'added':
        return p.theme.dangerText;
      case 'removed':
      case 'decreased':
        return p.theme.successText;
      case 'unchanged':
        return p.theme.warningText;
      default:
        throw new Error(`Invalid change type: ${p.changeType}`);
    }
  }};
`;
