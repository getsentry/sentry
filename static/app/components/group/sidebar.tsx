import {Component, Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import isObject from 'lodash/isObject';
import keyBy from 'lodash/keyBy';
import pickBy from 'lodash/pickBy';

import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import ErrorBoundary from 'sentry/components/errorBoundary';
import AssignedTo from 'sentry/components/group/assignedTo';
import ExternalIssueList from 'sentry/components/group/externalIssuesList';
import OwnedBy from 'sentry/components/group/ownedBy';
import GroupParticipants from 'sentry/components/group/participants';
import GroupReleaseStats from 'sentry/components/group/releaseStats';
import SuggestedOwners from 'sentry/components/group/suggestedOwners/suggestedOwners';
import SuspectReleases from 'sentry/components/group/suspectReleases';
import GroupTagDistributionMeter from 'sentry/components/group/tagDistributionMeter';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  CurrentRelease,
  Environment,
  Group,
  Organization,
  Project,
  TagWithTopValues,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import withApi from 'sentry/utils/withApi';

type Props = WithRouterProps & {
  api: Client;
  environments: Environment[];
  group: Group;
  organization: Organization;
  project: Project;
  event?: Event;
};

type State = {
  environments: Environment[];
  participants: Group['participants'];
  allEnvironmentsGroupData?: Group;
  currentRelease?: CurrentRelease;
  error?: boolean;
  tagsWithTopValues?: Record<string, TagWithTopValues>;
};

class BaseGroupSidebar extends Component<Props, State> {
  state: State = {
    participants: [],
    environments: this.props.environments,
  };

  componentDidMount() {
    this.fetchAllEnvironmentsGroupData();
    this.fetchCurrentRelease();
    this.fetchParticipants();
    this.fetchTagData();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (!isEqual(nextProps.environments, this.props.environments)) {
      this.setState({environments: nextProps.environments}, this.fetchTagData);
    }
  }

  trackAssign: React.ComponentProps<typeof AssignedTo>['onAssign'] = () => {
    const {group, project, organization, location} = this.props;
    const {alert_date, alert_rule_id, alert_type} = location.query;
    trackAdvancedAnalyticsEvent('issue_details.action_clicked', {
      organization,
      project_id: parseInt(project.id, 10),
      group_id: parseInt(group.id, 10),
      issue_category: group.issueCategory,
      action_type: 'assign',
      alert_date:
        typeof alert_date === 'string' ? getUtcDateString(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined,
    });
  };

  async fetchAllEnvironmentsGroupData() {
    const {group, api} = this.props;

    // Fetch group data for all environments since the one passed in props is filtered for the selected environment
    // The charts rely on having all environment data as well as the data for the selected env
    try {
      const query = {collapse: 'release'};
      const allEnvironmentsGroupData = await api.requestPromise(`/issues/${group.id}/`, {
        query,
      });
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({allEnvironmentsGroupData});
    } catch {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({error: true});
    }
  }

  async fetchCurrentRelease() {
    const {group, api} = this.props;

    try {
      const {currentRelease} = await api.requestPromise(
        `/issues/${group.id}/current-release/`
      );
      this.setState({currentRelease});
    } catch {
      this.setState({error: true});
    }
  }

  async fetchParticipants() {
    const {group, api} = this.props;

    try {
      const participants = await api.requestPromise(`/issues/${group.id}/participants/`);
      this.setState({
        participants,
        error: false,
      });
      return participants;
    } catch {
      this.setState({
        error: true,
      });
      return [];
    }
  }

  async fetchTagData() {
    const {api, group} = this.props;

    try {
      // Fetch the top values for the current group's top tags.
      const data = await api.requestPromise(`/issues/${group.id}/tags/`, {
        query: pickBy({
          key: group.tags.map(tag => tag.key),
          environment: this.state.environments.map(env => env.name),
        }),
      });
      this.setState({tagsWithTopValues: keyBy(data, 'key')});
    } catch {
      this.setState({
        tagsWithTopValues: {},
        error: true,
      });
    }
  }

  renderPluginIssue() {
    const issues: React.ReactNode[] = [];
    (this.props.group.pluginIssues || []).forEach(plugin => {
      const issue = plugin.issue;
      // # TODO(dcramer): remove plugin.title check in Sentry 8.22+
      if (issue) {
        issues.push(
          <Fragment key={plugin.slug}>
            <span>{`${plugin.shortName || plugin.name || plugin.title}: `}</span>
            <a href={issue.url}>{isObject(issue.label) ? issue.label.id : issue.label}</a>
          </Fragment>
        );
      }
    });

    if (!issues.length) {
      return null;
    }

    return (
      <SidebarSection.Wrap>
        <SidebarSection.Title>{t('External Issues')}</SidebarSection.Title>
        <SidebarSection.Content>
          <ExternalIssues>{issues}</ExternalIssues>
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }

  renderParticipantData() {
    const {error, participants = []} = this.state;

    if (error) {
      return (
        <LoadingError
          message={t('There was an error while trying to load participants.')}
        />
      );
    }

    return participants.length !== 0 && <GroupParticipants participants={participants} />;
  }

  render() {
    const {event, group, organization, project, environments} = this.props;
    const {allEnvironmentsGroupData, currentRelease, tagsWithTopValues} = this.state;
    const projectId = project.slug;

    return (
      <Container>
        {!organization.features.includes('issue-actions-v2') && (
          <PageFiltersContainer>
            <EnvironmentPageFilter alignDropdown="right" />
          </PageFiltersContainer>
        )}

        <Feature organization={organization} features={['issue-details-owners']}>
          <OwnedBy group={group} project={project} organization={organization} />
          <AssignedTo group={group} projectId={project.id} onAssign={this.trackAssign} />
        </Feature>

        {event && <SuggestedOwners project={project} group={group} event={event} />}

        <GroupReleaseStats
          organization={organization}
          project={project}
          environments={environments}
          allEnvironments={allEnvironmentsGroupData}
          group={group}
          currentRelease={currentRelease}
        />

        <Feature organization={organization} features={['active-release-monitor-alpha']}>
          <SuspectReleases group={group} />
        </Feature>

        {event && (
          <ErrorBoundary mini>
            <ExternalIssueList project={project} group={group} event={event} />
          </ErrorBoundary>
        )}

        {this.renderPluginIssue()}

        <SidebarSection.Wrap>
          <SidebarSection.Title>{t('Tag Summary')}</SidebarSection.Title>
          <SidebarSection.Content>
            {!tagsWithTopValues ? (
              <TagPlaceholders>
                <Placeholder height="40px" />
                <Placeholder height="40px" />
                <Placeholder height="40px" />
                <Placeholder height="40px" />
              </TagPlaceholders>
            ) : (
              group.tags.map(tag => {
                const tagWithTopValues = tagsWithTopValues[tag.key];
                const topValues = tagWithTopValues ? tagWithTopValues.topValues : [];
                const topValuesTotal = tagWithTopValues
                  ? tagWithTopValues.totalValues
                  : 0;

                return (
                  <GroupTagDistributionMeter
                    key={tag.key}
                    tag={tag.key}
                    totalValues={topValuesTotal}
                    topValues={topValues}
                    name={tag.name}
                    organization={organization}
                    projectId={projectId}
                    group={group}
                  />
                );
              })
            )}
            {group.tags.length === 0 && (
              <p data-test-id="no-tags">
                {environments.length
                  ? t('No tags found in the selected environments')
                  : t('No tags found')}
              </p>
            )}
          </SidebarSection.Content>
        </SidebarSection.Wrap>

        {this.renderParticipantData()}
      </Container>
    );
  }
}

const PageFiltersContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const Container = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const TagPlaceholders = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: row;
`;

const ExternalIssues = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(2)};
`;

const GroupSidebar = withApi(withRouter(BaseGroupSidebar));

export default GroupSidebar;
