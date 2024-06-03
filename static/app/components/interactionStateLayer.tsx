import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {defined} from 'sentry/utils';

interface StateLayerProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: React.ElementType;
  color?: string;
  higherOpacity?: boolean;
  isHovered?: boolean;
  isPressed?: boolean;
}

const InteractionStateLayer = styled(
  (props: StateLayerProps) => {
    const {children, as: Element = 'span', ...rest} = props;

    // Here, using `as` directly doesn't work because it loses the `role` prop. Instead, manually propagating the props does the right thing.
    return (
      <Element {...rest} role="presentation">
        {children}
      </Element>
    );
  },
  {shouldForwardProp: p => isPropValid(p) || p === 'as'}
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
      ? p.isHovered &&
        css`
          opacity: ${p.higherOpacity ? 0.085 : 0.06};
        `
      : // If isHovered is undefined, then fallback to a default hover selector
        css`
          *:hover:not(:focus-visible) > & {
            opacity: ${p.higherOpacity ? 0.085 : 0.06};
          }
        `}

  ${p =>
    defined(p.isPressed)
      ? p.isPressed &&
        css`
          &&& {
            opacity: ${p.higherOpacity ? 0.12 : 0.09};
          }
        `
      : // If isPressed is undefined, then fallback to default press selectors
        css`
          *:active > &&,
          *[aria-expanded='true'] > &&,
          *[aria-selected='true'] > && {
            opacity: ${p.higherOpacity ? 0.12 : 0.09};
          }
        `}


  *:disabled &&,
  *[aria-disabled="true"] && {
    opacity: 0;
  }
`;

export default InteractionStateLayer;
