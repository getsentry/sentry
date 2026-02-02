import type {ComponentProps, CSSProperties} from 'react';

import type {Tooltip} from '@sentry/scraps/tooltip';

import HeaderCell from 'sentry/components/replays/virtualizedGrid/headerCell';
import {t} from 'sentry/locale';
import type useSortErrors from 'sentry/views/replays/detail/errorList/useSortErrors';

type SortConfig = ReturnType<typeof useSortErrors>['sortConfig'];
type Props = {
  handleSort: ReturnType<typeof useSortErrors>['handleSort'];
  index: number;
  sortConfig: SortConfig;
  style: CSSProperties;
  ref?: React.Ref<HTMLButtonElement>;
};

const COLUMNS: Array<{
  field: SortConfig['by'];
  label: string;
  tooltipTitle?: ComponentProps<typeof Tooltip>['title'];
}> = [
  {field: 'id', label: t('Event ID')},
  {field: 'title', label: t('Title')},
  {field: 'project', label: t('Issue')},
  {field: 'level', label: t('Level')},
  {field: 'timestamp', label: t('Timestamp')},
];

export const COLUMN_COUNT = COLUMNS.length;

function ErrorHeaderCell({handleSort, index, sortConfig, style, ref}: Props) {
  const {field, label, tooltipTitle} = COLUMNS[index]!;
  return (
    <HeaderCell
      ref={ref}
      handleSort={handleSort}
      field={field}
      label={label}
      tooltipTitle={tooltipTitle}
      sortConfig={sortConfig}
      style={style}
    />
  );
}

export default ErrorHeaderCell;
