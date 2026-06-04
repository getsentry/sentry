import type {CSSProperties} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Container} from '@sentry/scraps/layout';

export interface TimelineItemProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  colorConfig?: {
    icon: string;
    iconBorder: string;
    title: string;
  };
  /**
   * Used by tanstack virtualizer to track the index of the item.
   */
  'data-index'?: number;
  icon?: React.ReactNode;
  isActive?: boolean;
  marker?: React.ReactNode;
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
  marker,
  colorConfig,
  timestamp,
  isActive = false,
  titleTrailingItems,
  ref,
  ...props
}: TimelineItemProps) {
  const theme = useTheme();
  const config = colorConfig ?? makeDefaultColorConfig(theme);
  const hasMarker = marker !== undefined;

  return (
    <Row ref={ref} hasMarker={hasMarker} {...props}>
      {hasMarker && <MarkerWrapper>{marker}</MarkerWrapper>}
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
      <Container justifySelf="center" width="0" height="100%" column="span 1" />
      <Content hasMarker={hasMarker}>{children}</Content>
    </Row>
  );
}

function makeDefaultColorConfig(theme: Theme) {
  return {
    title: theme.tokens.content.primary,
    icon: theme.tokens.content.secondary,
    iconBorder: theme.tokens.content.secondary,
  };
}

const Row = styled('div')<{hasMarker: boolean; showLastLine?: boolean}>`
  position: relative;
  color: ${p => p.theme.tokens.content.secondary};
  display: grid;
  align-items: start;
  grid-template-rows: auto auto;
  grid-template-columns: ${p =>
    p.hasMarker ? '22px 22px minmax(50px, 1fr) auto' : '22px minmax(50px, 1fr) auto'};
  grid-column-gap: ${p => (p.hasMarker ? p.theme.space.xs : p.theme.space.md)};
  margin: ${p => p.theme.space.md} 0;
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

const MarkerWrapper = styled('div')`
  grid-column: span 1;
  display: grid;
  place-items: center;
  min-width: 22px;
  min-height: 22px;
`;

const IconWrapper = styled('div')`
  grid-column: span 1;
  border-radius: 100%;
  border: 1px solid;
  background: ${p => p.theme.tokens.background.primary};
  svg {
    display: block;
    margin: ${p => p.theme.space.xs};
  }
`;

const Title = styled('div')`
  font-weight: bold;
  text-align: left;
  grid-column: span 1;
  font-size: ${p => p.theme.font.size.md};
`;

const Content = styled('div')<{hasMarker: boolean}>`
  text-align: left;
  grid-column: ${p => (p.hasMarker ? '3 / -1' : 'span 2')};
  color: ${p => p.theme.tokens.content.secondary};
  margin: ${p => p.theme.space['2xs']} 0 0;
  font-size: ${p => p.theme.font.size.sm};
  word-wrap: break-word;
`;

const Text = styled('div')`
  text-align: left;
  font-size: ${p => p.theme.font.size.sm};
  &:only-child {
    margin-top: 0;
  }
`;

const Data = styled('div')`
  border-radius: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  margin: ${p => p.theme.space.sm} 0 0 -${p => p.theme.space.sm};
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  background: ${p => p.theme.tokens.background.secondary};
  position: relative;
  &:only-child {
    margin-top: 0;
  }
`;

const TimelineContainer = styled('div')`
  position: relative;
  /* vertical line connecting items */
  &::before {
    content: '';
    position: absolute;
    left: 10.5px;
    width: 1px;
    top: 0;
    bottom: 0;
    /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
    background: ${p => p.theme.tokens.border.transparent.neutral.muted};
  }
`;

export const Timeline = {
  Data,
  Text,
  Item,
  Container: TimelineContainer,
};
