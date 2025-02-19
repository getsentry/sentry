import type {ReactNode} from 'react';
import {Fragment} from 'react';

import AlertLink from 'sentry/components/alertLink';
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
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

export default function ExternalIssueList({group, event, project}: Props) {
  const organization = useOrganization();
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

  const renderers: Record<ExternalIssueType, (props: any) => ReactNode> = {
    'sentry-app-issue': ({sentryApp, ...props}: SentryAppIssueComponent['props']) => (
      <ErrorBoundary key={sentryApp.slug} mini>
        <SentryAppExternalIssueActions {...props} />
      </ErrorBoundary>
    ),
    'integration-issue': (props: IntegrationComponent['props']) => (
      <ExternalIssueActions {...props} />
    ),
    'plugin-action': ({plugin}: PluginActionComponent['props']) => (
      <IssueSyncListElement externalIssueLink={plugin[1]}>
        {plugin[0]}
      </IssueSyncListElement>
    ),
    'plugin-issue': (props: PluginIssueComponent['props']) => (
      <PluginActions {...props} />
    ),
  };

  return (
    <SidebarSection.Wrap data-test-id="linked-issues">
      <SidebarSection.Title>{t('Issue Tracking')}</SidebarSection.Title>
      <SidebarSection.Content>
        {actions.length ? (
          actions.map(({type, key, props}) => (
            <Fragment key={key}>{renderers[type](props)}</Fragment>
          ))
        ) : (
          <AlertLink
            priority="muted"
            size="small"
            to={`/settings/${organization.slug}/integrations/?category=issue%20tracking`}
          >
            {t('Track this issue in Jira, GitHub, etc.')}
          </AlertLink>
        )}
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}
