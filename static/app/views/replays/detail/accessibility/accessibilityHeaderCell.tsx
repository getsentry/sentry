import {ComponentProps, CSSProperties, forwardRef, ReactNode} from 'react';

import HeaderCell from 'sentry/components/replays/virtualizedGrid/headerCell';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import useSortAccessibility from 'sentry/views/replays/detail/accessibility/useSortAccessibility';

type SortConfig = ReturnType<typeof useSortAccessibility>['sortConfig'];
type Props = {
  handleSort: ReturnType<typeof useSortAccessibility>['handleSort'];
  index: number;
  sortConfig: SortConfig;
  style: CSSProperties;
};

const COLUMNS: {
  field: SortConfig['by'];
  label: ReactNode;
  tooltipTitle?: ComponentProps<typeof Tooltip>['title'];
}[] = [
  {
    field: 'impact',
    label: '',
  },
  {
    field: 'id',
    label: t('Type'),
  },
  {field: 'element', label: t('Element')},
];

export const COLUMN_COUNT = COLUMNS.length;

const AccessibilityHeaderCell = forwardRef<HTMLButtonElement, Props>(
  ({handleSort, index, sortConfig, style}: Props, ref) => {
    const {field, label, tooltipTitle} = COLUMNS[index];
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
);

export default AccessibilityHeaderCell;
