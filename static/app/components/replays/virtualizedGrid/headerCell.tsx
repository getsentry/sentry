import type {CSSProperties, ReactNode} from 'react';
import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconInfo} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type BaseRecord = Record<string, unknown>;
interface SortConfig<RecordType extends BaseRecord> {
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
  display: block;
`;

function CatchClicks({children}: {children: ReactNode}) {
  return <div onClick={e => e.stopPropagation()}>{children}</div>;
}

function HeaderCell(
  {field, handleSort, label, sortConfig, style, tooltipTitle}: Props<BaseRecord>,
  ref: any
) {
  return (
    <HeaderButton style={style} onClick={() => handleSort(field)} ref={ref}>
      {label}
      {tooltipTitle ? (
        <Tooltip isHoverable title={<CatchClicks>{tooltipTitle}</CatchClicks>}>
          <StyledIconInfo size="xs" />
        </Tooltip>
      ) : null}
      <IconArrow
        color="gray300"
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

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
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

export default forwardRef<HTMLButtonElement, Props<BaseRecord>>(HeaderCell) as <
  T extends BaseRecord,
>(
  props: Props<T> & {ref?: React.ForwardedRef<HTMLButtonElement>}
) => ReturnType<typeof HeaderCell>;
