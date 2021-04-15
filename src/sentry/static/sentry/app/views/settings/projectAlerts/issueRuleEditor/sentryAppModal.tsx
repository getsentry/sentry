import React from 'react';
import styled from '@emotion/styled';

import AlertLink from 'app/components/alertLink';
import AsyncComponent from 'app/components/asyncComponent';
import ErrorBoundary from 'app/components/errorBoundary';
import ExternalIssueActions from 'app/components/group/externalIssueActions';
import PluginActions from 'app/components/group/pluginActions';
import SentryAppExternalIssueActions from 'app/components/group/sentryAppExternalIssueActions';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import Placeholder from 'app/components/placeholder';
import {IconGeneric} from 'app/icons';
import {t} from 'app/locale';
import ExternalIssueStore from 'app/stores/externalIssueStore';
import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';
import SentryAppInstallationStore from 'app/stores/sentryAppInstallationsStore';
import space from 'app/styles/space';
import {
  Group,
  GroupIntegration,
  Organization,
  PlatformExternalIssue,
  Project,
  SentryAppComponent,
  SentryAppInstallation,
} from 'app/types';
import {Event} from 'app/types/event';
import withOrganization from 'app/utils/withOrganization';


type Props = AsyncComponent['props'] & {
  project: Project;
  organization: Organization;
};

type State = AsyncComponent['state'] & {
  components: SentryAppComponent[];
  sentryAppInstallations: SentryAppInstallation[];
};

class ExternalIssueList extends AsyncComponent<Props, State> {
  unsubscribables: any[] = [];

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [];
  }

  constructor(props: Props) {
    super(props, {});
    this.state = Object.assign({}, this.state, {
      components: SentryAppComponentsStore.getInitialState(),
      sentryAppInstallations: SentryAppInstallationStore.getInitialState(),
    });
  }

  UNSAFE_componentWillMount() {
    super.UNSAFE_componentWillMount();

    this.unsubscribables = [
      SentryAppInstallationStore.listen(this.onSentryAppInstallationChange, this),
      SentryAppComponentsStore.listen(this.onSentryAppComponentsChange, this),
    ];
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    this.unsubscribables.forEach(unsubscribe => unsubscribe());
  }

  onSentryAppInstallationChange = (sentryAppInstallations: SentryAppInstallation[]) => {
    this.setState({sentryAppInstallations});
  };

  onSentryAppComponentsChange = (sentryAppComponents: SentryAppComponent[]) => {
    const components = sentryAppComponents.filter(c => c.type === 'issue-link');
    this.setState({components});
  };



  renderSentryAppIssues() {
    const {sentryAppInstallations, components} = this.state;
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

      return (
        <ErrorBoundary key={sentryApp.slug} mini>
          <SentryAppExternalIssueActions
            key={sentryApp.slug}
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

  renderLoading() {
    return (
      <SidebarSection data-test-id="linked-issues" title={t('Linked Issues')}>
        <Placeholder height="120px" />
      </SidebarSection>
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
      <SidebarSection data-test-id="linked-issues" title={t('Linked Issues')}>
        {showSetup && (
          <AlertLink
            icon={<IconGeneric />}
            priority="muted"
            size="small"
            to={`/settings/${this.props.organization.slug}/integrations`}
          >
            {t('Set up Issue Tracking')}
          </AlertLink>
        )}
        {sentryAppIssues && <Wrapper>{sentryAppIssues}</Wrapper>}
      </SidebarSection>
    );
  }
}

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

export default withOrganization(ExternalIssueList);
