import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

import type {CssSize} from 'sentry/utils/number/toPixels';
import toPixels from 'sentry/utils/number/toPixels';

interface FlexProps {
  align?: CSSProperties['alignItems'];
  column?: boolean;
  flex?: CSSProperties['flex'];
  gap?: number | CssSize;
  h?: number | CssSize;
  justify?: CSSProperties['justifyContent'];
  p?: number | CssSize;
  w?: number | CssSize;
  wrap?: CSSProperties['flexWrap'];
}

const FlexContainer = styled('div')<FlexProps>`
  /* these can all come from a better base primitive */
  display: flex;
  height: ${p => toPixels(p.h)};
  width: ${p => toPixels(p.w)};
  padding: ${p => toPixels(p.p)};
  /* flex specific */
  flex-direction: ${p => (p.column ? 'column' : 'row')};
  justify-content: ${p => p.justify};
  align-items: ${p => p.align};
  gap: ${p => toPixels(p.gap)};
  flex-wrap: ${p => p.wrap};
  flex: ${p => p.flex ?? 'initial'};
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
  ...FlexContainer,
  Item: FlexItem,
});
