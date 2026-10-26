import type {ComponentProps} from 'react';

import type {Tooltip} from '@sentry/scraps/tooltip';

import {HeaderCell} from 'sentry/components/replays/virtualizedGrid/headerCell';
import type {ColumnAlign} from 'sentry/components/tables/sortableHeaderCell';
import {t} from 'sentry/locale';
import type {useSortErrors} from 'sentry/views/explore/replays/detail/errorList/useSortErrors';

type SortConfig = ReturnType<typeof useSortErrors>['sortConfig'];
type Props = {
  handleSort: ReturnType<typeof useSortErrors>['handleSort'];
  index: number;
  sortConfig: SortConfig;
};

const COLUMNS: Array<{
  field: SortConfig['by'];
  label: string;
  width: string;
  align?: ColumnAlign;
  tooltipTitle?: ComponentProps<typeof Tooltip>['title'];
}> = [
  {field: 'id', label: t('Event ID'), width: '88px'},
  {field: 'title', label: t('Title'), width: 'minmax(200px, 1fr)'},
  {field: 'project', label: t('Issue'), width: '144px'},
  {field: 'level', label: t('Level'), width: '72px'},
  {field: 'timestamp', label: t('Timestamp'), width: '104px', align: 'right'},
];

export const TABLE_COLUMNS = COLUMNS.map(({field, width}) => ({key: field, width}));

export function ErrorHeaderCell({handleSort, index, sortConfig}: Props) {
  const {align, field, label, tooltipTitle} = COLUMNS[index]!;
  return (
    <HeaderCell
      align={align}
      handleSort={handleSort}
      field={field}
      label={label}
      tooltipTitle={tooltipTitle}
      sortConfig={sortConfig}
    />
  );
}
