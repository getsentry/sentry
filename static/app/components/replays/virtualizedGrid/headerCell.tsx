import {CSSProperties, forwardRef, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconInfo} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Crumb} from 'sentry/types/breadcrumbs';
import type {NetworkSpan} from 'sentry/views/replays/types';

interface SortCrumbs {
  asc: boolean;
  by: keyof Crumb | string;
  getValue: (row: Crumb) => any;
}
interface SortSpans {
  asc: boolean;
  by: keyof NetworkSpan | string;
  getValue: (row: NetworkSpan) => any;
}

type Props = {
  field: string;
  handleSort: (fieldName: string) => void;
  label: string;
  sortConfig: SortCrumbs | SortSpans;
  style: CSSProperties;
  tooltipTitle: undefined | ReactNode;
};

const StyledIconInfo = styled(IconInfo)`
  display: block;
`;

function CatchClicks({children}: {children: ReactNode}) {
  return <div onClick={e => e.stopPropagation()}>{children}</div>;
}

const HeaderCell = forwardRef<HTMLButtonElement, Props>(
  ({field, handleSort, label, sortConfig, style, tooltipTitle}: Props, ref) => (
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
  )
);

const HeaderButton = styled('button')`
  border: 0;
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
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
