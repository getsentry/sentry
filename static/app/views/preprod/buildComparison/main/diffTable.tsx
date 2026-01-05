/** Various shared components for diff tables */

import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconAdd, IconFix, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DiffItem, DiffType} from 'sentry/views/preprod/types/appSizeTypes';

export const ITEMS_PER_PAGE = 40;

export type DiffTableSort = {
  field: string;
  kind: 'asc' | 'desc';
};

type DiffChangeElements = {
  icon: React.ReactNode;
  label: string;
  type: 'success' | 'danger' | 'warning';
};

export function getDiffChangeElements(diffItem: DiffItem): DiffChangeElements {
  let change: {
    icon: React.ReactNode;
    label: string;
    type: 'success' | 'danger' | 'warning';
  };
  switch (diffItem.type) {
    case 'added':
      change = {
        type: 'danger',
        label: t('Added'),
        icon: <IconAdd />,
      };
      break;
    case 'removed':
      change = {
        type: 'success',
        label: t('Removed'),
        icon: <IconSubtract />,
      };
      break;
    case 'increased':
      change = {
        type: 'danger',
        label: t('Increased'),
        icon: <IconAdd />,
      };
      break;
    case 'decreased':
      change = {
        type: 'success',
        label: t('Decreased'),
        icon: <IconSubtract />,
      };
      break;
    default:
      change = {
        type: 'warning',
        label: t('Unchanged'),
        icon: <IconFix />,
      };
      break;
  }
  return change;
}

export const DiffTableWithColumns = styled(SimpleTable)<{
  gridTemplateColumns: string;
}>`
  overflow-x: auto;
  overflow-y: auto;
  grid-template-columns: ${p => p.gridTemplateColumns};
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
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
      default:
        throw new Error(`Invalid change type: ${p.changeType}`);
    }
  }};
`;
