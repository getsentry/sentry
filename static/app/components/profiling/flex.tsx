import {CSSProperties} from 'react';
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
  m?: number | CssSize;
  maxH?: number | CssSize;
  mb?: number | CssSize;
  minH?: number | CssSize;
  ml?: number | CssSize;
  mr?: number | CssSize;
  mt?: number | CssSize;
  mx?: number | CssSize;
  my?: number | CssSize;
  p?: number | CssSize;
  pb?: number | CssSize;
  pl?: number | CssSize;
  pr?: number | CssSize;
  pt?: number | CssSize;
  px?: number | CssSize;
  py?: number | CssSize;
  w?: number | CssSize;
  wrap?: CSSProperties['flexWrap'];
}

// TODO(@eliashussary): move to common folder / bring up in fe-tsc
const FlexContainer = styled('div')<FlexProps>`
  /* these can all come from a better base primitive */
  display: flex;
  height: ${p => toPixels(p.h)};
  width: ${p => toPixels(p.w)};
  min-height: ${p => toPixels(p.minH)};
  max-height: ${p => toPixels(p.maxH)};
  /* padding */
  padding: ${p => toPixels(p.p)};
  padding-left: ${p => toPixels(p.pl || p.px)};
  padding-right: ${p => toPixels(p.pr || p.px)};
  padding-top: ${p => toPixels(p.pt || p.py)};
  padding-bottom: ${p => toPixels(p.pb || p.py)};
  /* margin */
  margin: ${p => toPixels(p.m)};
  margin-left: ${p => toPixels(p.ml || p.mx)};
  margin-right: ${p => toPixels(p.mr || p.mx)};
  margin-top: ${p => toPixels(p.mt || p.my)};
  margin-bottom: ${p => toPixels(p.mb || p.my)};
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
  Container: FlexContainer,
  Item: FlexItem,
});
