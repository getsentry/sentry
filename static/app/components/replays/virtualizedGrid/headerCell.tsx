import type {CSSProperties, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {ColumnAlign} from 'sentry/components/tables/sortableHeaderCell';
import {IconInfo} from 'sentry/icons';

type BaseRecord = Record<string, unknown>;
export interface SortConfig<RecordType extends BaseRecord> {
  asc: boolean;
  by: keyof RecordType | string;
  getValue: (row: RecordType) => any;
}

type Props<SortableRecord extends BaseRecord> = {
  align: undefined | ColumnAlign;
  field: string;
  handleSort: (fieldName: string) => void;
  label: ReactNode;
  sortConfig: SortConfig<SortableRecord>;
  style: CSSProperties;
  tooltipTitle: undefined | ReactNode;
};

const StyledIconInfo = styled(IconInfo)`
  margin-left: ${p => p.theme.space.xs};
  margin-top: 1px;
  vertical-align: text-top;
`;

function CatchClicks({children}: {children: ReactNode}) {
  return <div onClick={e => e.stopPropagation()}>{children}</div>;
}

export function HeaderCell<T extends BaseRecord>({
  align,
  field,
  handleSort,
  label,
  sortConfig,
  style,
  tooltipTitle,
}: Props<T>) {
  return (
    <SimpleTable.HeaderCell
      align={align}
      handleSortClick={() => handleSort(field)}
      sort={sortConfig.by === field ? (sortConfig.asc ? 'asc' : 'desc') : undefined}
      style={style}
    >
      {label}
      {tooltipTitle ? (
        <Tooltip title={<CatchClicks>{tooltipTitle}</CatchClicks>}>
          <StyledIconInfo size="xs" />
        </Tooltip>
      ) : null}
    </SimpleTable.HeaderCell>
  );
}
