import React from 'react';
import styled from '@emotion/styled';

import {
  Group,
  Project,
  Organization,
  PlatformExternalIssue,
  Event,
  SentryAppComponent,
  SentryAppInstallation,
  GroupIntegration,
} from 'app/types';
import {t} from 'app/locale';
import AlertLink from 'app/components/alertLink';
import AsyncComponent from 'app/components/asyncComponent';
import ErrorBoundary from 'app/components/errorBoundary';
import ExternalIssueActions from 'app/components/group/externalIssueActions';
import ExternalIssueStore from 'app/stores/externalIssueStore';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import PluginActions from 'app/components/group/pluginActions';
import {IconGeneric} from 'app/icons';
import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';
import SentryAppExternalIssueActions from 'app/components/group/sentryAppExternalIssueActions';
import SentryAppInstallationStore from 'app/stores/sentryAppInstallationsStore';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

type Props = AsyncComponent['props'] & {
  group: Group;
  project: Project;
  organization: Organization;
  event: Event;
};

type State = AsyncComponent['state'] & {
  components: SentryAppComponent[];
  sentryAppInstallations: SentryAppInstallation[];
  externalIssues: PlatformExternalIssue[];
  integrations: GroupIntegration[];
};

class ExternalIssueList extends AsyncComponent<Props, State> {
  unsubscribables: any[] = [];

  getEndpoints(): [string, string][] {
    const {group} = this.props;
    return [['integrations', `/groups/${group.id}/integrations/`]];
  }

  constructor(props: Props) {
    super(props, {});
    this.state = Object.assign({}, this.state, {
      components: SentryAppComponentsStore.getInitialState(),
      sentryAppInstallations: SentryAppInstallationStore.getInitialState(),
      externalIssues: ExternalIssueStore.getInitialState(),
    });
  }

  UNSAFE_componentWillMount() {
    super.UNSAFE_componentWillMount();

    this.unsubscribables = [
      SentryAppInstallationStore.listen(this.onSentryAppInstallationChange, this),
      ExternalIssueStore.listen(this.onExternalIssueChange, this),
      SentryAppComponentsStore.listen(this.onSentryAppComponentsChange, this),
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

  onSentryAppComponentsChange = (sentryAppComponents: SentryAppComponent[]) => {
    const components = sentryAppComponents.filter(c => c.type === 'issue-link');
    this.setState({components});
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
      let integrations = await this.api.requestPromise(
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

    const activeIntegrationsByProvider: {
      [key: string]: GroupIntegration[];
    } = activeIntegrations.reduce((acc, curr) => {
      if (acc[curr.provider.key]) {
        acc[curr.provider.key].push(curr);
      } else {
        acc[curr.provider.key] = [curr];
      }
      return acc;
    }, {});

    return activeIntegrations.length
      ? Object.keys(activeIntegrationsByProvider)
          .sort((a, b) => a.localeCompare(b))
          .map(provider => (
            <ExternalIssueActions
              key={provider}
              configurations={activeIntegrationsByProvider[provider]}
              group={group}
              onChange={this.updateIntegrations.bind(this)}
            />
          ))
      : null;
  }

  renderSentryAppIssues() {
    const {externalIssues, sentryAppInstallations, components} = this.state;
    const {group} = this.props;
    if (components.length === 0) {
      return null;
    }

    return components.map(component => {
      const {sentryApp} = component;
      const installation = sentryAppInstallations.find(
        i => i.app.uuid === sentryApp.uuid
      );
      //should always find a match but TS complains if we don't handle this case
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

  renderBody() {
    const sentryAppIssues = this.renderSentryAppIssues();
    const integrationIssues = this.renderIntegrationIssues(this.state.integrations);
    const pluginIssues = this.renderPluginIssues();
    const pluginActions = this.renderPluginActions();
    if (!sentryAppIssues && !integrationIssues && !pluginIssues && !pluginActions) {
      return (
        <React.Fragment>
          <h6 data-test-id="linked-issues">
            <span>Linked Issues</span>
          </h6>
          <AlertLink
            icon={<IconGeneric />}
            priority="muted"
            size="small"
            to={`/settings/${this.props.organization.slug}/integrations`}
          >
            {t('Set up Issue Tracking')}
          </AlertLink>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment>
        <h6 data-test-id="linked-issues">
          <span>Linked Issues</span>
        </h6>
        {sentryAppIssues && <Wrapper>{sentryAppIssues}</Wrapper>}
        {integrationIssues && <Wrapper>{integrationIssues}</Wrapper>}
        {pluginIssues && <Wrapper>{pluginIssues}</Wrapper>}
        {pluginActions && <Wrapper>{pluginActions}</Wrapper>}
      </React.Fragment>
    );
  }
}

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

export default withOrganization(ExternalIssueList);
