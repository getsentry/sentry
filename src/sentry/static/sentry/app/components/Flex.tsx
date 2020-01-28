import React from 'react';
import styled from '@emotion/styled';
import forwardProps from 'app/utils/forwardProps';

type DisplayType = 'flex' | 'inline-flex';
type FlexDirectionType = 'row' | 'row-reverse' | 'column' | 'column-reverse';
type FlexWrapType = 'nowrap' | 'wrap' | 'wrap-reverse';
type JustifyContentType =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
type AlignContentType =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'stretch';
type AlignItemsType = 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
type AlignSelfType =
  | 'auto'
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'baseline'
  | 'stretch';

interface FlexProps {
  display?: DisplayType;
  flexDirection?: FlexDirectionType;
  flexWrap?: FlexWrapType;
  justifyContent?: JustifyContentType;
  alignContent?: AlignContentType;
  alignItems?: AlignItemsType;
  alignSelf?: AlignSelfType;
  flexGrow?: number;
  flexShrink?: number;
}

interface Props extends FlexProps {
  className?: string;
  onClick?: () => void;
}

const flexProps: Array<keyof FlexProps> = [
  'display',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignContent',
  'alignItems',
  'flexGrow',
  'alignSelf',
];

const Container = styled('div')<FlexProps>(props => forwardProps(props, flexProps));

const Flex: React.FC<Props> = ({children, ...props}) => (
  <Container {...props}>{children}</Container>
);

Flex.defaultProps = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignContent: 'stretch',
  alignItems: 'stretch',
  flexWrap: 'nowrap',
  flexGrow: 0,
  flexShrink: 0,
};

export default Flex;
