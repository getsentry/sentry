import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import useStreamLinedExternalIssueData from 'sentry/components/group/externalIssuesList/useStreamlinedExternalIssueData';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

export function StreamlinedExternalIssueList({group, event, project}: Props) {
  const {isLoading, integrations, linkedIssues} = useStreamLinedExternalIssueData({
    group,
    event,
    project,
  });

  if (isLoading) {
    return (
      <SidebarSection.Wrap data-test-id="linked-issues">
        <SidebarSection.Title>{t('Issue Tracking')}</SidebarSection.Title>
        <SidebarSection.Content>
          <Placeholder height="120px" />
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }

  return (
    <SidebarSection.Wrap data-test-id="linked-issues">
      <SidebarSection.Title>{t('Issue Tracking')}</SidebarSection.Title>
      <SidebarSection.Content>
        <IssueActionWrapper>
          {linkedIssues.map(({key, displayName, displayIcon}) => (
            <ErrorBoundary key={key} mini>
              <Tooltip title={t('Unlink Issue')} isHoverable>
                <LinkedIssue>
                  {displayIcon && <IconWrapper>{displayIcon}</IconWrapper>}
                  <IssueActionName>{displayName}</IssueActionName>
                </LinkedIssue>
              </Tooltip>
            </ErrorBoundary>
          ))}
          {integrations.length
            ? integrations.map(({key, displayName, displayIcon}) => (
                <ErrorBoundary key={key} mini>
                  <IssueActionButton size="zero" icon={displayIcon}>
                    <IssueActionName>{displayName}</IssueActionName>
                  </IssueActionButton>
                </ErrorBoundary>
              ))
            : null}
        </IssueActionWrapper>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

const IssueActionWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const LinkedIssue = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
  padding: ${space(0.5)} ${space(0.75)};
  line-height: 1.05;
  border: 1px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const IssueActionButton = styled(Button)`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} ${space(0.75)};
  line-height: 1.05;
  border: 1px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  font-weight: normal;
`;

const IconWrapper = styled('div')`
  display: flex;
`;

const IssueActionName = styled('div')`
  ${p => p.theme.overflowEllipsis}
  max-width: 200px;
`;
