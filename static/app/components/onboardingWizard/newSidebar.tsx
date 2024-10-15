import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Chevron} from 'sentry/components/chevron';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import ProgressRing from 'sentry/components/progressRing';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import type {CommonSidebarProps} from 'sentry/components/sidebar/types';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import {isDemoWalkthrough} from 'sentry/utils/demoMode';

function getPanelDescription(walkthrough: boolean) {
  if (walkthrough) {
    return {
      title: t('Guided Tours'),
      description: t('Take a guided tour to see what Sentry can do for you'),
    };
  }
  return {
    title: t('Quick Start'),
    description: t('Walk through this guide to get the most out of Sentry right away.'),
  };
}

interface TaskProps {
  description: string;
  title: string;
  status?: 'waiting' | 'completed';
}

function Task({title, description, status}: TaskProps) {
  if (status === 'completed') {
    return (
      <TaskWrapper completed>
        <strong>{title}</strong>
        <IconCheckmark color="successText" isCircled />
      </TaskWrapper>
    );
  }

  if (status === 'waiting') {
    return (
      <TaskWrapper>
        <InteractionStateLayer />
        <div>
          <strong>{title}</strong>
          <div>{description}</div>
        </div>
        <Tooltip title={t('Waiting for event')}>
          <PulsingIndicator />
        </Tooltip>
      </TaskWrapper>
    );
  }

  return (
    <TaskWrapper>
      <InteractionStateLayer />
      <div>
        <strong>{title}</strong>
        <div>{description}</div>
      </div>
    </TaskWrapper>
  );
}

interface TaskGroupProps {
  description: string;
  title: string;
  totalCompletedTasks: number;
  totalTasks: number;
  expanded?: boolean;
}

function TaskGroup({
  title,
  description,
  totalCompletedTasks,
  totalTasks,
  expanded,
}: TaskGroupProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  return (
    <TaskGroupWrapper>
      <TaskGroupHeader onClick={() => setIsExpanded(!isExpanded)}>
        <InteractionStateLayer />
        <span>
          <strong>{title}</strong>
          <div>{description}</div>
        </span>
        <Chevron
          direction={isExpanded ? 'up' : 'down'}
          role="presentation"
          size="large"
        />
      </TaskGroupHeader>
      {isExpanded && (
        <Fragment>
          <hr />
          <TaskGroupBody>
            <TaskGroupProgress>
              {tct('[totalCompletedTasks] out of [totalTasks] tasks completed', {
                totalCompletedTasks,
                totalTasks,
              })}
              <ProgressRing
                value={(totalCompletedTasks / totalTasks) * 100}
                progressEndcaps="round"
                size={16}
                barWidth={2}
              />
            </TaskGroupProgress>
            <Task title="Test" description="description" status="waiting" />
            <Task title="Test" description="description" />
            <Task title="Test" description="description" />
            <TaskGroupProgress completed>{t('Completed')}</TaskGroupProgress>
            <Task title="Test" description="description" status="completed" />
            <Task title="Test" description="description" status="completed" />
          </TaskGroupBody>
        </Fragment>
      )}
    </TaskGroupWrapper>
  );
}

interface NewSidebarProps extends Pick<CommonSidebarProps, 'orientation' | 'collapsed'> {
  onClose: () => void;
}

export function NewSidebar({onClose, orientation, collapsed}: NewSidebarProps) {
  const walkthrough = isDemoWalkthrough();
  const {title, description} = getPanelDescription(walkthrough);

  return (
    <Wrapper
      collapsed={collapsed}
      hidePanel={onClose}
      orientation={orientation}
      title={title}
    >
      <Content>
        <p>{description}</p>
        <TaskGroup
          title="Test"
          description="description"
          totalCompletedTasks={3}
          totalTasks={10}
          expanded
        />
        <TaskGroup
          title="Test"
          description="description"
          totalCompletedTasks={3}
          totalTasks={10}
        />
        <TaskGroup
          title="Test"
          description="description"
          totalCompletedTasks={3}
          totalTasks={10}
        />
      </Content>
    </Wrapper>
  );
}

const Wrapper = styled(SidebarPanel)`
  width: 450px;
`;

const Content = styled('div')`
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};

  p {
    margin-bottom: ${space(1)};
  }
`;

const TaskGroupWrapper = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)};

  hr {
    border-color: ${p => p.theme.translucentBorder};
    margin: ${space(1)} -${space(1)};
  }
`;

const TaskGroupHeader = styled('div')`
  cursor: pointer;
  display: grid;
  grid-template-columns: 1fr max-content;
  padding: ${space(1)} ${space(1.5)};
  gap: ${space(1.5)};
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  align-items: center;
`;

const TaskGroupBody = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
`;

const TaskGroupProgress = styled('div')<{completed?: boolean}>`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  padding: ${space(0.75)} ${space(1.5)};
  ${p =>
    p.completed
      ? css`
          color: ${p.theme.successText};
        `
      : css`
          color: ${p.theme.subText};
          display: grid;
          grid-template-columns: 1fr max-content;
          align-items: center;
          gap: ${space(1)};
        `}
`;

const TaskWrapper = styled('div')<{completed?: boolean}>`
  padding: ${space(1)} ${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  gap: ${space(1)};

  ${p =>
    p.completed
      ? css`
          strong {
            opacity: 0.5;
          }
        `
      : css`
          position: relative;
          cursor: pointer;
        `}
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin: 0 ${space(0.5)};
`;
