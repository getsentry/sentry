import {CSSProperties} from 'react';
import styled from '@emotion/styled';

const px = (val: string | number | undefined) =>
  typeof val === 'string' ? val : typeof val === 'number' ? val + 'px' : undefined;

interface FlexProps {
  align?: CSSProperties['alignItems'];
  column?: boolean;
  gap?: number | string;
  h?: number | string;
  justify?: CSSProperties['justifyContent'];
  m?: number | string;
  maxH?: number | string;
  mb?: number | string;
  minH?: number | string;
  ml?: number | string;
  mr?: number | string;
  mt?: number | string;
  mx?: number | string;
  my?: number | string;
  p?: number | string;
  pb?: number | string;
  pl?: number | string;
  pr?: number | string;
  pt?: number | string;
  px?: number | string;
  py?: number | string;
  w?: number | string;
  wrap?: CSSProperties['flexWrap'];
}

// TODO(@eliashussary): move to common folder / bring up in fe-tsc
const FlexContainer = styled('div')<FlexProps>`
  /* these can all come from a better base primitive */
  display: flex;
  height: ${p => px(p.h)};
  width: ${p => px(p.w)};
  min-height: ${p => px(p.minH)};
  max-height: ${p => px(p.maxH)};
  /* padding */
  padding: ${p => px(p.p)};
  padding-left: ${p => px(p.pl || p.px)};
  padding-right: ${p => px(p.pr || p.px)};
  padding-top: ${p => px(p.pt || p.py)};
  padding-bottom: ${p => px(p.pb || p.py)};
  /* margin */
  margin: ${p => px(p.m)};
  margin-left: ${p => px(p.ml || p.mx)};
  margin-right: ${p => px(p.mr || p.mx)};
  margin-top: ${p => px(p.mt || p.my)};
  margin-bottom: ${p => px(p.mb || p.my)};
  /* flex specific */
  flex-direction: ${p => (p.column ? 'column' : 'row')};
  justify-content: ${p => p.justify};
  align-items: ${p => p.align};
  gap: ${p => px(p.gap)};
  flex-wrap: ${p => p.wrap};
`;

interface FlexItemProps {
  basis?: CSSProperties['flexBasis'];
  grow?: CSSProperties['flexGrow'];
  shrink?: CSSProperties['flexShrink'];
}

const FlexItem = styled('div')<FlexItemProps>`
  /* // TODO: determine sane defaults for these */
  flex-grow: ${p => p.grow};
  flex-shrink: ${p => p.shrink};
  flex-basis: ${p => p.basis};
  overflow: hidden;
`;

export const Flex = Object.assign(FlexContainer, {
  ...FlexContainer,
  Container: FlexContainer,
  Item: FlexItem,
});
