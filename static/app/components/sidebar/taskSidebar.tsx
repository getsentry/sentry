import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';

import {CommonSidebarProps} from './types';

interface TaskSidebarProps
  extends Pick<CommonSidebarProps, 'orientation' | 'collapsed' | 'hidePanel'> {
  children?: React.ReactNode;
}

export function TaskSidebar(props: TaskSidebarProps) {
  const {children, collapsed, hidePanel, orientation} = props;

  return (
    <TaskSidebarPanel
      orientation={orientation}
      collapsed={collapsed}
      hidePanel={hidePanel}
    >
      <TopRightBackgroundImage src={HighlightTopRightPattern} />
      {children}
    </TaskSidebarPanel>
  );
}

export const TaskSidebarList = styled('div')`
  display: grid;
  grid-auto-flow: row;
  grid-template-columns: 100%;
  gap: ${space(1)};
  margin: ${space(1)} ${space(4)} ${space(4)} ${space(4)};
`;
const TaskSidebarPanel = styled(SidebarPanel)`
  width: 450px;
`;

const TopRightBackgroundImage = styled('img')`
  position: absolute;
  top: 0;
  right: 0;
  width: 60%;
  user-select: none;
`;

interface EventIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  status: 'received' | 'waiting';
}

export const EventIndicator = styled(
  ({children, ...props}: React.HTMLAttributes<HTMLDivElement> & EventIndicatorProps) => (
    <div {...props}>
      {props.status === 'waiting' ? <PulsingIndicator /> : '🎉 '}
      {children}
    </div>
  )
)`
  display: flex;
  align-items: center;
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => (p.status === 'waiting' ? p.theme.pink400 : p.theme.green400)};
`;

export const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin-right: ${space(1)};
`;
