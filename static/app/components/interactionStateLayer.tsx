import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {defined} from 'sentry/utils';

interface StateLayerProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string;
  higherOpacity?: boolean;
  isHovered?: boolean;
  isPressed?: boolean;
}

function getControlledOpacityValue(p: StateLayerProps) {
  if (p.isPressed) {
    return p.higherOpacity ? 0.12 : 0.09;
  }

  if (p.isHovered) {
    return p.higherOpacity ? 0.085 : 0.06;
  }

  return null;
}

const InteractionStateLayer = styled(
  (props: StateLayerProps) => <span role="presentation" {...props} />,
  {shouldForwardProp: p => typeof p === 'string' && isPropValid(p)}
)`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  transform: translate(-50%, -50%);

  box-sizing: content-box;
  border-radius: inherit;
  border: inherit;
  color: ${p => (p.color ? p.theme[p.color] ?? p.color : 'currentcolor')};
  background-color: currentcolor;
  border-color: currentcolor;
  pointer-events: none;

  opacity: 0;

  ${p =>
    !defined(p.isHovered)
      ? css`
          *:hover:not(.focus-visible) > & {
            opacity: ${p.higherOpacity ? 0.085 : 0.06};
          }
        `
      : ''}

  ${p =>
    !defined(p.isPressed)
      ? css`
          *:active > &&,
          *[aria-expanded='true'] > &&,
          *[aria-selected='true'] > && {
            opacity: ${p.higherOpacity ? 0.12 : 0.09};
          }
        `
      : ''}

  ${p =>
    getControlledOpacityValue(p)
      ? css`
          opacity: ${getControlledOpacityValue(p)};
        `
      : ''}

  *:disabled &&,
  *[aria-disabled="true"] && {
    opacity: 0;
  }
`;

export default InteractionStateLayer;
