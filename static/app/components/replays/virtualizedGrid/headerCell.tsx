import type {CSSProperties, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {IconArrow, IconInfo} from 'sentry/icons';
import {space} from 'sentry/styles/space';

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
  ref?: React.Ref<HTMLButtonElement>;
};

const StyledIconInfo = styled(IconInfo)`
  display: block;
`;

function CatchClicks({children}: {children: ReactNode}) {
  return <div onClick={e => e.stopPropagation()}>{children}</div>;
}

function HeaderCell<T extends BaseRecord>({
  field,
  handleSort,
  label,
  sortConfig,
  style,
  tooltipTitle,
  ref,
}: Props<T>) {
  return (
    <HeaderButton style={style} onClick={() => handleSort(field)} ref={ref}>
      {label}
      {tooltipTitle ? (
        <Tooltip isHoverable title={<CatchClicks>{tooltipTitle}</CatchClicks>}>
          <StyledIconInfo size="xs" />
        </Tooltip>
      ) : null}
      <IconArrow
        variant="muted"
        size="xs"
        direction={sortConfig.by === field && !sortConfig.asc ? 'down' : 'up'}
        style={{visibility: sortConfig.by === field ? 'visible' : 'hidden'}}
      />
    </HeaderButton>
  );
}

const HeaderButton = styled('button')`
  border: 0;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};

  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 16px;
  text-align: unset;
  text-transform: uppercase;
  white-space: nowrap;

  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(0.5)} ${space(1)} ${space(0.5)} ${space(1.5)};

  svg {
    margin-left: ${space(0.25)};
  }
`;

export default HeaderCell;
