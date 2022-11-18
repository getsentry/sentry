import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {defined} from 'sentry/utils';

interface StateLayerProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string;
  higherOpacity?: boolean;
  isHovered?: boolean;
  isPressed?: boolean;
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
    defined(p.isHovered)
      ? `
        *:not(.focus-visible) > & {
          opacity: ${p.isHovered ? (p.higherOpacity ? 0.085 : 0.06) : 0};
        }
      `
      : `
        *:hover:not(.focus-visible) > & {
          opacity: ${p.higherOpacity ? 0.085 : 0.06};
        }
      `}

  ${p =>
    defined(p.isPressed)
      ? `
        && {
          opacity: ${p.isPressed ? (p.higherOpacity ? 0.12 : 0.09) : 0};
        }
      `
      : `
        *:active > &&,
        *[aria-expanded='true'] > &&,
        *[aria-selected='true'] > && {
          opacity: ${p.higherOpacity ? 0.12 : 0.09};
        }
      `}

  *:disabled > && {
    opacity: 0;
  }
`;

export default InteractionStateLayer;
