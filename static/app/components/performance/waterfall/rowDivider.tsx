import styled from '@emotion/styled';

import {IconAdd, IconFire, IconSubtract} from 'app/icons';
import space from 'app/styles/space';
import {Aliases, Color} from 'app/utils/theme';

export const DividerContainer = styled('div')`
  position: relative;
  min-width: 1px;
`;

export const DividerLine = styled('div')<{showDetail?: boolean}>`
  background-color: ${p => (p.showDetail ? p.theme.textColor : p.theme.border)};
  position: absolute;
  height: 100%;
  width: 1px;
  transition: background-color 125ms ease-in-out;
  z-index: ${p => p.theme.zIndex.traceView.dividerLine};

  /* enhanced hit-box */
  &:after {
    content: '';
    z-index: -1;
    position: absolute;
    left: -2px;
    top: 0;
    width: 5px;
    height: 100%;
  }

  &.hovering {
    background-color: ${p => p.theme.textColor};
    width: 3px;
    transform: translateX(-1px);
    margin-right: -2px;

    cursor: ew-resize;

    &:after {
      left: -2px;
      width: 7px;
    }
  }
`;

export const DividerLineGhostContainer = styled('div')`
  position: absolute;
  width: 100%;
  height: 100%;
`;

const BadgeBorder = styled('div')<{borderColor: Color | keyof Aliases}>`
  position: absolute;
  margin: ${space(0.25)};
  left: -11px;
  background: ${p => p.theme.background};
  width: ${space(3)};
  height: ${space(3)};
  border: 1px solid ${p => p.theme[p.borderColor]};
  border-radius: 50%;
  z-index: ${p => p.theme.zIndex.traceView.dividerLine};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export function ErrorBadge() {
  return (
    <BadgeBorder borderColor="red300">
      <IconFire color="red300" size="xs" />
    </BadgeBorder>
  );
}

export function EmbeddedTransactionBadge({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <BadgeBorder
      borderColor="border"
      onClick={event => {
        event.stopPropagation();
        event.preventDefault();
        onClick();
      }}
    >
      {expanded ? (
        <IconSubtract color="textColor" size="xs" />
      ) : (
        <IconAdd color="textColor" size="xs" />
      )}
    </BadgeBorder>
  );
}
