import {useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {getFormattedTimestamp} from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/time/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {Color} from 'sentry/utils/theme';

export interface ColorConfig {
  primary: Color;
  secondary: Color;
}

export interface TimelineItemProps {
  icon: React.ReactNode;
  timeString: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  colorConfig?: ColorConfig;
  isActive?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  startTimeString?: string;
}

export function Item({
  title,
  children,
  icon,
  timeString,
  startTimeString,
  colorConfig = {primary: 'gray300', secondary: 'gray200'},
  isActive = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: TimelineItemProps) {
  const theme = useTheme();
  const placeholderTime = useRef(new Date().toTimeString()).current;
  const {primary, secondary} = colorConfig;
  const hasRelativeTime = defined(startTimeString);
  const {
    displayTime,
    date,
    timeWithMilliseconds: preciseTime,
  } = hasRelativeTime
    ? getFormattedTimestamp(timeString, startTimeString, true)
    : getFormattedTimestamp(timeString, placeholderTime);

  return (
    <Row
      color={secondary}
      hasLowerBorder={isActive}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        borderBottom: `1px solid ${isActive ? theme[secondary] : 'transparent'}`,
      }}
    >
      <IconWrapper
        style={{
          borderColor: isActive ? theme[secondary] : 'transparent',
          color: theme[primary],
        }}
      >
        {icon}
      </IconWrapper>
      <Title style={{color: theme[primary]}}>{title}</Title>
      <Timestamp>
        <Tooltip title={`${preciseTime} - ${date}`} skipWrapper>
          {displayTime}
        </Tooltip>
      </Timestamp>
      <Spacer
        style={{borderLeft: `1px solid ${isActive ? theme.border : 'transparent'}`}}
      />
      <Content>{children}</Content>
    </Row>
  );
}

interface GroupProps {
  children: React.ReactNode;
}

export function Container({children}: GroupProps) {
  return <Wrapper>{children}</Wrapper>;
}

const Wrapper = styled('div')`
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

const Row = styled('div')<{hasLowerBorder: boolean}>`
  position: relative;
  color: ${p => p.theme.subText};
  display: grid;
  align-items: center;
  grid-template: auto auto / 22px 1fr auto;
  grid-column-gap: ${space(1)};
  margin: ${space(1)} 0;
  &:first-child {
    margin-top: 0;
  }
  &:last-child {
    margin-bottom: 0;
    background: ${p => p.theme.background};
  }
  &:last-child > :last-child {
    margin-bottom: ${p => (p.hasLowerBorder ? space(1) : 0)};
  }
`;

const IconWrapper = styled('div')`
  grid-column: span 1;
  border-radius: 100%;
  border: 1px solid;
  background: ${p => p.theme.background};
  svg {
    display: block;
    margin: ${space(0.5)};
  }
`;

const Title = styled('p')`
  margin: 0;
  font-weight: bold;
  text-transform: capitalize;
  grid-column: span 1;
`;

const Timestamp = styled('p')`
  margin: 0 ${space(1)};
  color: ${p => p.theme.subText};
  text-decoration: underline dashed ${p => p.theme.subText};
`;

const Spacer = styled('div')`
  grid-column: span 1;
  height: 100%;
  width: 0;
  justify-self: center;
`;

const Content = styled('div')`
  grid-column: span 2;
  color: ${p => p.theme.subText};
  margin: ${space(0.25)} 0 ${space(2)};
`;

export const Text = styled('div')`
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

export const Timeline = {
  Data,
  Text,
  Item,
  Container,
};

export default Timeline;
