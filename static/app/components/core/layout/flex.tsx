import type {CSSProperties} from 'react';
import {css} from '@emotion/react';
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

const FlexContainer = styled('div')<FlexProps>`
  display: ${p => (p.inline ? 'inline-flex' : 'flex')};
  flex-direction: ${p => p.direction};
  justify-content: ${p => p.justify};
  align-items: ${p => p.align};
  gap: ${p => p.gap};
  flex-wrap: ${p => p.wrap};
  flex: ${p => p.flex};
`;

interface FlexItemProps {
  basis?: CSSProperties['flexBasis'];
  flex?: CSSProperties['flex'];
  grow?: CSSProperties['flexGrow'];
  shrink?: CSSProperties['flexShrink'];
}

const FlexItem = styled('div')<FlexItemProps>`
  ${p =>
    p.flex
      ? css`
          flex: ${p.flex};
        `
      : css`
          flex-grow: ${p.grow ?? 0};
          flex-shrink: ${p.shrink ?? 1};
          flex-basis: ${p.basis ?? 'auto'};
        `}
`;

export const Flex = Object.assign(FlexContainer, {
  Item: FlexItem,
});
