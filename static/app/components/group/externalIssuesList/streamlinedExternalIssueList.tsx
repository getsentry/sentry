import type {ReactNode} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalIssueActions from 'sentry/components/group/externalIssuesList/externalIssueActions';
import type {
  ExternalIssueType,
  IntegrationComponent,
  PluginActionComponent,
  PluginIssueComponent,
  SentryAppIssueComponent,
} from 'sentry/components/group/externalIssuesList/types';
import useExternalIssueData from 'sentry/components/group/externalIssuesList/useExternalIssueData';
import PluginActions from 'sentry/components/group/pluginActions';
import SentryAppExternalIssueActions from 'sentry/components/group/sentryAppExternalIssueActions';
import IssueSyncListElement from 'sentry/components/issueSyncListElement';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
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
  const {isLoading, actions} = useExternalIssueData({
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
          {actions.length
            ? actions.map(({type, key, displayName, props}) => (
                <ErrorBoundary key={key} mini>
                  <IssueAction>
                    <IssueActionName>{displayName}</IssueActionName>
                  </IssueAction>
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

const IssueAction = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(0.5)};
  line-height: 1.05;
  border: 1px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const IssueActionName = styled('div')`
  ${p => p.theme.overflowEllipsis}
  max-width: 100px;
`;
