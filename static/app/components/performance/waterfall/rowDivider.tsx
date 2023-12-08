import styled from '@emotion/styled';

import {IconAdd, IconFire, IconProfiling, IconSubtract} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {Aliases, Color} from 'sentry/utils/theme';

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

export const BadgeBorder = styled('div')<{
  color: Color | keyof Aliases;
  fillBackground?: boolean;
}>`
  position: absolute;
  margin: ${space(0.25)};
  left: -11px;
  background: ${p => (p.fillBackground ? p.theme[p.color] : p.theme.background)};
  width: ${space(3)};
  height: ${space(3)};
  border: 1px solid ${p => p.theme[p.color]};
  border-radius: 50%;
  z-index: ${p => p.theme.zIndex.traceView.dividerLine};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export function ErrorBadge() {
  return (
    <BadgeBorder color="error">
      <IconFire color="errorText" size="xs" />
    </BadgeBorder>
  );
}

export function EmbeddedTransactionBadge({
  inTraceView = false,
  expanded,
  onClick,
}: {
  expanded: boolean;
  inTraceView: boolean;
  onClick: () => void;
}) {
  return (
    <StyledBadgeBorder
      inTraceView={inTraceView}
      data-test-id="embedded-transaction-badge"
      color="border"
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
    </StyledBadgeBorder>
  );
}

export function ProfileBadge() {
  return (
    <BadgeBorder data-test-id="profile-badge" color="activeText" fillBackground>
      <IconProfiling color="background" size="xs" />
    </BadgeBorder>
  );
}

const StyledBadgeBorder = styled(BadgeBorder)<{inTraceView: boolean}>`
  ${p => p.inTraceView && 'left: 0;'}
`;
