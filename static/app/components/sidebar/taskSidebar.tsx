import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';

import type {CommonSidebarProps} from './types';

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
