import type {CSSProperties, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {SortableHeaderCell} from 'sentry/components/tables/sortableHeaderCell';
import {IconInfo} from 'sentry/icons';

type BaseRecord = Record<string, unknown>;
export interface SortConfig<RecordType extends BaseRecord> {
  asc: boolean;
  by: keyof RecordType | string;
  getValue: (row: RecordType) => any;
}

type Props<SortableRecord extends BaseRecord> = {
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
  field,
  handleSort,
  label,
  sortConfig,
  style,
  tooltipTitle,
}: Props<T>) {
  return (
    <HeaderButton
      direction={sortConfig.by === field ? (sortConfig.asc ? 'asc' : 'desc') : undefined}
      onSort={() => handleSort(field)}
      style={style}
    >
      {label}
      {tooltipTitle ? (
        <Tooltip isHoverable title={<CatchClicks>{tooltipTitle}</CatchClicks>}>
          <StyledIconInfo size="xs" />
        </Tooltip>
      ) : null}
    </HeaderButton>
  );
}

const HeaderButton = styled(SortableHeaderCell)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.secondary};

  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 16px;
  text-transform: uppercase;

  width: 100%;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md} ${p => p.theme.space.xs}
    ${p => p.theme.space.lg};
`;
