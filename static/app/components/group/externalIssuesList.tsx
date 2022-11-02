import styled from '@emotion/styled';

import AlertLink from 'sentry/components/alertLink';
import AsyncComponent from 'sentry/components/asyncComponent';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalIssueActions from 'sentry/components/group/externalIssueActions';
import PluginActions from 'sentry/components/group/pluginActions';
import SentryAppExternalIssueActions from 'sentry/components/group/sentryAppExternalIssueActions';
import IssueSyncListElement from 'sentry/components/issueSyncListElement';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import ExternalIssueStore from 'sentry/stores/externalIssueStore';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import space from 'sentry/styles/space';
import {
  Group,
  GroupIntegration,
  Organization,
  PlatformExternalIssue,
  Project,
  SentryAppComponent,
  SentryAppInstallation,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withOrganization from 'sentry/utils/withOrganization';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';

type Props = AsyncComponent['props'] & {
  components: SentryAppComponent[];
  event: Event;
  group: Group;
  organization: Organization;
  project: Project;
};

type State = AsyncComponent['state'] & {
  externalIssues: PlatformExternalIssue[];
  integrations: GroupIntegration[];
  sentryAppInstallations: SentryAppInstallation[];
};

class ExternalIssueList extends AsyncComponent<Props, State> {
  unsubscribables: any[] = [];

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {group} = this.props;
    return [['integrations', `/groups/${group.id}/integrations/`]];
  }

  constructor(props: Props) {
    super(props, {});
    this.state = Object.assign({}, this.state, {
      sentryAppInstallations: SentryAppInstallationStore.getInitialState(),
      externalIssues: ExternalIssueStore.getInitialState(),
    });
  }

  UNSAFE_componentWillMount() {
    super.UNSAFE_componentWillMount();

    this.unsubscribables = [
      SentryAppInstallationStore.listen(this.onSentryAppInstallationChange, this),
      ExternalIssueStore.listen(this.onExternalIssueChange, this),
    ];

    this.fetchSentryAppData();
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    this.unsubscribables.forEach(unsubscribe => unsubscribe());
  }

  onSentryAppInstallationChange = (sentryAppInstallations: SentryAppInstallation[]) => {
    this.setState({sentryAppInstallations});
  };

  onExternalIssueChange = (externalIssues: PlatformExternalIssue[]) => {
    this.setState({externalIssues});
  };

  // We want to do this explicitly so that we can handle errors gracefully,
  // instead of the entire component not rendering.
  //
  // Part of the API request here is fetching data from the Sentry App, so
  // we need to be more conservative about error cases since we don't have
  // control over those services.
  //
  fetchSentryAppData() {
    const {group, project, organization} = this.props;

    if (project && project.id && organization) {
      this.api
        .requestPromise(`/groups/${group.id}/external-issues/`)
        .then(data => {
          ExternalIssueStore.load(data);
          this.setState({externalIssues: data});
        })
        .catch(_error => {});
    }
  }

  async updateIntegrations(onSuccess = () => {}, onError = () => {}) {
    try {
      const {group} = this.props;
      const integrations = await this.api.requestPromise(
        `/groups/${group.id}/integrations/`
      );
      this.setState({integrations}, () => onSuccess());
    } catch (error) {
      onError();
    }
  }

  renderIntegrationIssues(integrations: GroupIntegration[] = []) {
    const {group} = this.props;

    const activeIntegrations = integrations.filter(
      integration => integration.status === 'active'
    );

    const activeIntegrationsByProvider: Map<string, GroupIntegration[]> =
      activeIntegrations.reduce((acc, curr) => {
        const items = acc.get(curr.provider.key);

        if (items) {
          acc.set(curr.provider.key, [...items, curr]);
        } else {
          acc.set(curr.provider.key, [curr]);
        }
        return acc;
      }, new Map());

    return activeIntegrations.length
      ? [...activeIntegrationsByProvider.entries()].map(([provider, configurations]) => (
          <ExternalIssueActions
            key={provider}
            configurations={configurations}
            group={group}
            onChange={this.updateIntegrations.bind(this)}
          />
        ))
      : null;
  }

  renderSentryAppIssues() {
    const {externalIssues, sentryAppInstallations} = this.state;
    const {components, group} = this.props;
    if (components.length === 0) {
      return null;
    }

    return components.map(component => {
      const {sentryApp, error: disabled} = component;
      const installation = sentryAppInstallations.find(
        i => i.app.uuid === sentryApp.uuid
      );
      // should always find a match but TS complains if we don't handle this case
      if (!installation) {
        return null;
      }

      const issue = (externalIssues || []).find(i => i.serviceType === sentryApp.slug);

      return (
        <ErrorBoundary key={sentryApp.slug} mini>
          <SentryAppExternalIssueActions
            key={sentryApp.slug}
            group={group}
            event={this.props.event}
            sentryAppComponent={component}
            sentryAppInstallation={installation}
            externalIssue={issue}
            disabled={disabled}
          />
        </ErrorBoundary>
      );
    });
  }

  renderPluginIssues() {
    const {group, project} = this.props;

    return group.pluginIssues && group.pluginIssues.length
      ? group.pluginIssues.map((plugin, i) => (
          <PluginActions group={group} project={project} plugin={plugin} key={i} />
        ))
      : null;
  }

  renderPluginActions() {
    const {group} = this.props;

    return group.pluginActions && group.pluginActions.length
      ? group.pluginActions.map((plugin, i) => (
          <IssueSyncListElement externalIssueLink={plugin[1]} key={i}>
            {plugin[0]}
          </IssueSyncListElement>
        ))
      : null;
  }

  renderLoading() {
    return (
      <SidebarSection.Wrap data-test-id="linked-issues">
        <SidebarSection.Title>{t('Linked Issues')}</SidebarSection.Title>
        <SidebarSection.Content>
          <Placeholder height="120px" />
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }

  renderBody() {
    const sentryAppIssues = this.renderSentryAppIssues();
    const integrationIssues = this.renderIntegrationIssues(this.state.integrations);
    const pluginIssues = this.renderPluginIssues();
    const pluginActions = this.renderPluginActions();
    const showSetup =
      !sentryAppIssues && !integrationIssues && !pluginIssues && !pluginActions;

    return (
      <SidebarSection.Wrap data-test-id="linked-issues">
        <SidebarSection.Title>{t('Issue Tracking')}</SidebarSection.Title>
        <SidebarSection.Content>
          {showSetup && (
            <AlertLink
              priority="muted"
              size="small"
              to={`/settings/${this.props.organization.slug}/integrations/?category=issue%20tracking`}
            >
              {t('Track this issue in Jira, GitHub, etc.')}
            </AlertLink>
          )}
          {sentryAppIssues && <Wrapper>{sentryAppIssues}</Wrapper>}
          {integrationIssues && <Wrapper>{integrationIssues}</Wrapper>}
          {pluginIssues && <Wrapper>{pluginIssues}</Wrapper>}
          {pluginActions && <Wrapper>{pluginActions}</Wrapper>}
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }
}

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

export default withSentryAppComponents(withOrganization(ExternalIssueList), {
  componentType: 'issue-link',
});
