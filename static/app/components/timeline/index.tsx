import type {CSSProperties} from 'react';
import {forwardRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {Color} from 'sentry/utils/theme';

export interface ColorConfig {
  icon: Color;
  iconBorder: Color;
  title: Color;
}

export interface TimelineItemProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  colorConfig?: ColorConfig;
  isActive?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  showLastLine?: boolean;
  style?: CSSProperties;
  timestamp?: React.ReactNode;
}

export const Item = forwardRef(function ItemInner(
  {
    title,
    children,
    icon,
    colorConfig = {title: 'gray400', icon: 'gray300', iconBorder: 'gray200'},
    timestamp,
    isActive = false,
    ...props
  }: TimelineItemProps,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const theme = useTheme();
  return (
    <Row ref={ref} {...props}>
      <IconWrapper
        style={{
          borderColor: isActive ? theme[colorConfig.iconBorder] : 'transparent',
          color: theme[colorConfig.icon],
        }}
        className="icon-wrapper"
      >
        {icon}
      </IconWrapper>
      <Title style={{color: theme[colorConfig.title]}}>{title}</Title>
      {timestamp ?? <div />}
      <Spacer />
      <Content>{children}</Content>
    </Row>
  );
});

const Row = styled('div')<{showLastLine?: boolean}>`
  position: relative;
  color: ${p => p.theme.subText};
  display: grid;
  align-items: start;
  grid-template: auto auto / 22px 1fr auto;
  grid-column-gap: ${space(1)};
  margin: ${space(1)} 0;
  &:first-child {
    margin-top: 0;
  }
  &:last-child {
    margin-bottom: 0;
    /* Show/hide connecting line from the last element of the timeline */
    background: ${p => (p.showLastLine ? 'transparent' : p.theme.background)};
  }
`;

const IconWrapper = styled('div')`
  grid-column: span 1;
  border-radius: 100%;
  border: 1px solid;
  background: ${p => p.theme.background};
  z-index: 10;
  svg {
    display: block;
    margin: ${space(0.5)};
  }
`;

const Title = styled('div')`
  font-weight: bold;
  text-align: left;
  grid-column: span 1;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Spacer = styled('div')`
  grid-column: span 1;
  height: 100%;
  width: 0;
  justify-self: center;
`;

const Content = styled('div')`
  text-align: left;
  grid-column: span 2;
  color: ${p => p.theme.subText};
  margin: ${space(0.25)} 0 0;
  font-size: ${p => p.theme.fontSizeSmall};
  word-wrap: break-word;
`;

export const Text = styled('div')`
  text-align: left;
  font-size: ${p => p.theme.fontSizeSmall};
  &:only-child {
    margin-top: 0;
  }
`;

export const Data = styled('div')`
  border-radius: ${space(0.5)};
  padding: ${space(0.25)} ${space(0.75)};
  border: 1px solid ${p => p.theme.translucentInnerBorder};
  margin: ${space(0.75)} 0 0 -${space(0.75)};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  background: ${p => p.theme.backgroundSecondary};
  position: relative;
  &:only-child {
    margin-top: 0;
  }
`;

export const Container = styled('div')`
  position: relative;
  /* vertical line connecting items */
  &::before {
    content: '';
    position: absolute;
    left: 10.5px;
    width: 1px;
    top: 0;
    bottom: 0;
    background: ${p => p.theme.border};
  }
`;

export const Timeline = {
  Data,
  Text,
  Item,
  Container,
};

export default Timeline;
