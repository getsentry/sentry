import {Fragment} from 'react';
import {WithRouterProps} from 'react-router';

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
import type {
  Group,
  GroupIntegration,
  Organization,
  PlatformExternalIssue,
  Project,
  SentryAppComponent,
  SentryAppInstallation,
} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import localStorage from 'sentry/utils/localStorage';
import withOrganization from 'sentry/utils/withOrganization';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';
import withSentryRouter from 'sentry/utils/withSentryRouter';

type Props = AsyncComponent['props'] &
  WithRouterProps & {
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
  /**
   * Filter external issues by integration key
   * Used for demos to limit the number of integrations shown
   */
  issueTrackingFilter?: string;
};

const issueTrackingFilterKey = 'issueTrackingFilter';

type ExternalIssueComponent = {
  component: React.ReactNode;
  key: string;
  disabled?: boolean;
  hasLinkedIssue?: boolean;
};

class ExternalIssueList extends AsyncComponent<Props, State> {
  unsubscribables: any[] = [];

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {group} = this.props;
    return [['integrations', `/groups/${group.id}/integrations/`]];
  }

  constructor(props: Props) {
    super(props, {});

    // Check for issueTracking query parameter and save to localStorage
    const issueTracking =
      this.props.location.query.issueTracking ??
      localStorage.getItem(issueTrackingFilterKey);
    if (typeof issueTracking === 'string') {
      localStorage.setItem(issueTrackingFilterKey, issueTracking.toLowerCase());
    }

    this.state = Object.assign({}, this.state, {
      sentryAppInstallations: SentryAppInstallationStore.getInitialState(),
      externalIssues: ExternalIssueStore.getInitialState(),
      issueTrackingFilter: ['', 'all'].includes(issueTracking)
        ? undefined
        : issueTracking,
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

  renderIntegrationIssues(): ExternalIssueComponent[] {
    const {group} = this.props;
    const integrations = this.state.integrations ?? [];

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

    return [...activeIntegrationsByProvider.entries()].map(
      ([provider, configurations]) => ({
        key: provider,
        disabled: false,
        hasLinkedIssue: configurations.some(x => x.externalIssues.length > 0),
        component: (
          <ExternalIssueActions
            configurations={configurations}
            group={group}
            onChange={this.updateIntegrations.bind(this)}
          />
        ),
      })
    );
  }

  renderSentryAppIssues(): ExternalIssueComponent[] {
    const {externalIssues, sentryAppInstallations} = this.state;
    const {components, group} = this.props;

    return components
      .map<ExternalIssueComponent | null>(component => {
        const {sentryApp, error: disabled} = component;
        const installation = sentryAppInstallations.find(
          i => i.app.uuid === sentryApp.uuid
        );
        // should always find a match but TS complains if we don't handle this case
        if (!installation) {
          return null;
        }

        const issue = (externalIssues || []).find(i => i.serviceType === sentryApp.slug);

        return {
          key: sentryApp.slug,
          disabled,
          hasLinkedIssue: !!issue,
          component: (
            <ErrorBoundary key={sentryApp.slug} mini>
              <SentryAppExternalIssueActions
                group={group}
                event={this.props.event}
                sentryAppComponent={component}
                sentryAppInstallation={installation}
                externalIssue={issue}
                disabled={disabled}
              />
            </ErrorBoundary>
          ),
        };
      })
      .filter((x): x is ExternalIssueComponent => x !== null);
  }

  renderPluginIssues(): ExternalIssueComponent[] {
    const {group, project} = this.props;

    return group.pluginIssues?.map((plugin, i) => ({
      key: `plugin-issue-${i}`,
      disabled: false,
      hasLinkedIssue: true,
      component: <PluginActions group={group} project={project} plugin={plugin} />,
    }));
  }

  renderPluginActions(): ExternalIssueComponent[] {
    const {group} = this.props;

    return (
      group.pluginActions?.map((plugin, i) => ({
        key: `plugin-action-${i}`,
        disabled: false,
        hasLinkedIssue: false,
        component: (
          <IssueSyncListElement externalIssueLink={plugin[1]}>
            {plugin[0]}
          </IssueSyncListElement>
        ),
      })) ?? []
    );
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
    const {issueTrackingFilter} = this.state;
    const sentryAppIssues = this.renderSentryAppIssues();
    const integrationIssues = this.renderIntegrationIssues();
    const pluginIssues = this.renderPluginIssues();
    const pluginActions = this.renderPluginActions();
    const actions = [
      ...sentryAppIssues,
      ...integrationIssues,
      ...pluginIssues,
      ...pluginActions,
    ].filter(action => !issueTrackingFilter || action.key === issueTrackingFilter);
    const showSetup = actions.length === 0;

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
          {actions
            // Put disabled actions last
            .sort((a, b) => Number(a.disabled) - Number(b.disabled))
            // Put actions with linked issues first
            .sort((a, b) => Number(b.hasLinkedIssue) - Number(a.hasLinkedIssue))
            .map(({component, key}) => (
              <Fragment key={key}>{component}</Fragment>
            ))}
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }
}

export default withSentryAppComponents(
  withOrganization(withSentryRouter(ExternalIssueList)),
  {
    componentType: 'issue-link',
  }
);
