import type {CSSProperties} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {space} from 'sentry/styles/space';

export interface TimelineItemProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  colorConfig?: {
    icon: string;
    iconBorder: string;
    title: string;
  };
  icon?: React.ReactNode;
  isActive?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  ref?: React.Ref<HTMLDivElement>;
  showLastLine?: boolean;
  style?: CSSProperties;
  timestamp?: React.ReactNode;
  titleTrailingItems?: React.ReactNode;
}

function Item({
  title,
  children,
  icon,
  colorConfig,
  timestamp,
  isActive = false,
  titleTrailingItems,
  ref,
  ...props
}: TimelineItemProps) {
  const theme = useTheme();
  const config = colorConfig ?? makeDefaultColorConfig(theme);

  return (
    <Row ref={ref} {...props}>
      {icon ? (
        <IconWrapper
          style={{
            borderColor: isActive ? config.iconBorder : 'transparent',
            color: config.icon,
          }}
          className="timeline-icon-wrapper"
        >
          {icon}
        </IconWrapper>
      ) : (
        <IconWrapper className="timeline-icon-wrapper" />
      )}
      <Flex align="center" gap="xs" wrap="wrap">
        <Title style={{color: config.title}}>{title}</Title>
        {titleTrailingItems}
      </Flex>
      {timestamp ?? <div />}
      <Spacer />
      <Content>{children}</Content>
    </Row>
  );
}

function makeDefaultColorConfig(theme: Theme) {
  return {
    title: theme.tokens.content.primary,
    icon: theme.tokens.content.muted,
    iconBorder: theme.tokens.content.muted,
  };
}

const Row = styled('div')<{showLastLine?: boolean}>`
  position: relative;
  color: ${p => p.theme.tokens.content.secondary};
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
    background: ${p =>
      p.showLastLine ? 'transparent' : p.theme.tokens.background.primary};
  }
`;

const IconWrapper = styled('div')`
  grid-column: span 1;
  border-radius: 100%;
  border: 1px solid;
  background: ${p => p.theme.tokens.background.primary};
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
  font-size: ${p => p.theme.fontSize.md};
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
  color: ${p => p.theme.tokens.content.secondary};
  margin: ${space(0.25)} 0 0;
  font-size: ${p => p.theme.fontSize.sm};
  word-wrap: break-word;
`;

const Text = styled('div')`
  text-align: left;
  font-size: ${p => p.theme.fontSize.sm};
  &:only-child {
    margin-top: 0;
  }
`;

const Data = styled('div')`
  border-radius: ${space(0.5)};
  padding: ${space(0.25)} ${space(0.75)};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  margin: ${space(0.75)} 0 0 -${space(0.75)};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  background: ${p => p.theme.backgroundSecondary};
  position: relative;
  &:only-child {
    margin-top: 0;
  }
`;

const Container = styled('div')`
  position: relative;
  /* vertical line connecting items */
  &::before {
    content: '';
    position: absolute;
    left: 10.5px;
    width: 1px;
    top: 0;
    bottom: 0;
    background: ${p => p.theme.tokens.border.transparent.neutral.muted};
  }
`;

export const Timeline = {
  Data,
  Text,
  Item,
  Container,
};
