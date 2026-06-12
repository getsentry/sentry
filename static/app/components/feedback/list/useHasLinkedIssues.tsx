import type {ExternalIssueComponent} from 'sentry/components/group/externalIssuesList/types';
import {useIssueTrackingFilter} from 'sentry/components/group/externalIssuesList/useIssueTrackingFilter';
import {SentryAppInstallationStore} from 'sentry/stores/sentryAppInstallationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSentryAppComponentsStore} from 'sentry/utils/useSentryAppComponentsStore';

type Props = {
  event: Event;
  group: Group;
};

export function useHasLinkedIssues({group, event}: Props) {
  const organization = useOrganization();
  const issueTrackingFilter = useIssueTrackingFilter();
  const components = useSentryAppComponentsStore({componentType: 'issue-link'});
  const sentryAppInstallations = useLegacyStore(SentryAppInstallationStore);

  const renderSentryAppIssues = (): ExternalIssueComponent[] => {
    return components
      .map<ExternalIssueComponent | null>(component => {
        const {sentryApp} = component;
        const disabled = Boolean(component.error);
        const installation = sentryAppInstallations.find(
          i => i.app.uuid === sentryApp.uuid
        );
        if (!installation) {
          return null;
        }

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
            sentryAppInstallation: installation,
            externalIssue: issue,
            disabled,
          },
        };
      })
      .filter((x): x is ExternalIssueComponent => x !== null);
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

  return {linkedIssues: integrationIssues.concat(sentryAppIssues)};
}
