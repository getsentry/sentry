import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

interface FlexProps {
  align?: CSSProperties['alignItems'];
  direction?: CSSProperties['flexDirection'];
  flex?: CSSProperties['flex'];
  gap?: CSSProperties['gap'];
  justify?: CSSProperties['justifyContent'];
  wrap?: CSSProperties['flexWrap'];
}

const FlexContainer = styled('div')<FlexProps>`
  display: flex;
  flex-direction: ${p => p.direction};
  justify-content: ${p => p.justify};
  align-items: ${p => p.align};
  gap: ${p => p.gap};
  flex-wrap: ${p => p.wrap};
  flex: ${p => p.flex};
`;

interface FlexItemProps {
  basis?: CSSProperties['flexBasis'];
  grow?: CSSProperties['flexGrow'];
  shrink?: CSSProperties['flexShrink'];
}

const FlexItem = styled('div')<FlexItemProps>`
  flex-grow: ${p => p.grow ?? 0};
  flex-shrink: ${p => p.shrink ?? 1};
  flex-basis: ${p => p.basis ?? 'auto'};
  overflow: hidden;
`;

export const Flex = Object.assign(FlexContainer, {
  Item: FlexItem,
});
