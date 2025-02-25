import type {ReactNode} from 'react';
import {Fragment} from 'react';

import {AlertLink} from 'sentry/components/core/alert/alertLink';
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
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  event: Event;
  group: Group;
  project: Project;
};

export default function IssueTrackingSection({group, event, project}: Props) {
  const organization = useOrganization();
  const {isLoading, actions} = useExternalIssueData({
    group,
    event,
    project,
  });

  if (isLoading) {
    return <Placeholder height="42px" width="500px" />;
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
      <IssueSyncListElement externalIssueLink={(plugin as any)[1]}>
        {(plugin as any)[0]}
      </IssueSyncListElement>
    ),
    'plugin-issue': (props: PluginIssueComponent['props']) => (
      <PluginActions {...props} />
    ),
  };

  return actions.length ? (
    <Fragment>
      {actions.map(({type, key, props}) => (
        <span
          key={key}
          onClick={() => {
            trackAnalytics('feedback.details-integration-issue-clicked', {
              organization,
              integration_key: key,
            });
          }}
        >
          {renderers[type](props)}
        </span>
      ))}
    </Fragment>
  ) : (
    <AlertLink.Container>
      <AlertLink
        type="muted"
        to={`/settings/${organization.slug}/integrations/?category=issue%20tracking`}
      >
        {t('Track this issue in Jira, GitHub, etc.')}
      </AlertLink>
    </AlertLink.Container>
  );
}
