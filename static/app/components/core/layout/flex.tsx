import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

interface FlexProps {
  align?: CSSProperties['alignItems'];
  direction?: CSSProperties['flexDirection'];
  flex?: CSSProperties['flex'];
  gap?: CSSProperties['gap'];
  /**
   * Determines whether the flex container should be displayed as an inline-flex.
   */
  inline?: boolean;
  justify?: CSSProperties['justifyContent'];
  wrap?: CSSProperties['flexWrap'];
}

export const Flex = styled('div', {
  shouldForwardProp: prop =>
    !['align', 'direction', 'flex', 'gap', 'inline', 'justify', 'wrap'].includes(prop),
})<FlexProps>`
  display: ${p => (p.inline ? 'inline-flex' : 'flex')};
  flex-direction: ${p => p.direction};
  justify-content: ${p => p.justify};
  align-items: ${p => p.align};
  gap: ${p => p.gap};
  flex-wrap: ${p => p.wrap};
  flex: ${p => p.flex};
`;
