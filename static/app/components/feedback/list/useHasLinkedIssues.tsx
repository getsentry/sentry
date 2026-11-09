import type {ExternalIssueComponent} from 'sentry/components/group/externalIssuesList/types';
import {useIssueTrackingFilter} from 'sentry/components/group/externalIssuesList/useIssueTrackingFilter';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSentryAppComponents} from 'sentry/utils/useSentryAppComponents';

type Props = {
  event: Event;
  group: Group;
};

export function useHasLinkedIssues({group, event}: Props) {
  const organization = useOrganization();
  const issueTrackingFilter = useIssueTrackingFilter();
  const components = useSentryAppComponents({
    componentType: 'issue-link',
  });

  const renderSentryAppIssues = (): ExternalIssueComponent[] => {
    return components.map<ExternalIssueComponent>(component => {
      const {sentryApp} = component;
      const disabled = Boolean(component.error);
      const issue = (group.sentryAppIssues || []).find(
        i => i.serviceType === sentryApp.slug
      );

      return {
        type: 'sentry-app-issue',
        key: sentryApp.slug,
        disabled,
        hasLinkedIssue: !!issue,
        props: {
          sentryApp,
          group,
          organization,
          event,
          sentryAppComponent: component,
          sentryAppInstallationUuid: component.installationUuid,
          externalIssue: issue,
          disabled,
        },
      };
    });
  };

  const renderIntegrationIssues = (): ExternalIssueComponent[] => {
    return (
      group.integrationIssues?.map(issue => ({
        type: 'integration-issue',
        key: issue.key,
        disabled: false,
        hasLinkedIssue: true,
        props: {
          configurations: [],
          externalIssue: issue,
          group,
          onChange: () => {},
        },
      })) ?? []
    );
  };

  const linkedIssues = [...renderSentryAppIssues(), ...renderIntegrationIssues()].filter(
    issue => !issueTrackingFilter || issue.key === issueTrackingFilter
  );

  const sentryAppIssues = linkedIssues.filter(
    a =>
      a.hasLinkedIssue &&
      a.type === 'sentry-app-issue' &&
      a.props.externalIssue?.issueId === group.id
  );

  const integrationIssues = linkedIssues.filter(a => a.type === 'integration-issue');

  return {linkedIssues: [...integrationIssues, ...sentryAppIssues]};
}
