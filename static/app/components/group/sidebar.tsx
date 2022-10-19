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
import AvatarList from 'sentry/components/avatar/avatarList';
import DateTime from 'sentry/components/dateTime';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import ErrorBoundary from 'sentry/components/errorBoundary';
import AssignedTo from 'sentry/components/group/assignedTo';
import ExternalIssueList from 'sentry/components/group/externalIssuesList';
import OwnedBy from 'sentry/components/group/ownedBy';
import GroupReleaseStats from 'sentry/components/group/releaseStats';
import SuggestedOwners from 'sentry/components/group/suggestedOwners/suggestedOwners';
import SuspectReleases from 'sentry/components/group/suspectReleases';
import GroupTagDistributionMeter from 'sentry/components/group/tagDistributionMeter';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import {
  AvatarUser,
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
import {userDisplayName} from 'sentry/utils/formatters';
import {isMobilePlatform} from 'sentry/utils/platform';
import withApi from 'sentry/utils/withApi';

import FeatureBadge from '../featureBadge';

import {MOBILE_TAGS, MOBILE_TAGS_FORMATTER, TagFacets} from './tagFacets';

type Props = WithRouterProps & {
  api: Client;
  environments: Environment[];
  group: Group;
  organization: Organization;
  project: Project;
  event?: Event;
};

type State = {
  allEnvironmentsGroupData?: Group;
  currentRelease?: CurrentRelease;
  error?: boolean;
  tagsWithTopValues?: Record<string, TagWithTopValues>;
};

class BaseGroupSidebar extends Component<Props, State> {
  state: State = {};

  componentDidMount() {
    this.fetchAllEnvironmentsGroupData();
    this.fetchCurrentRelease();
    this.fetchTagData();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.environments, this.props.environments)) {
      this.fetchTagData();
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

  async fetchTagData() {
    const {api, group} = this.props;

    try {
      // Fetch the top values for the current group's top tags.
      const data = await api.requestPromise(`/issues/${group.id}/tags/`, {
        query: pickBy({
          key: group.tags.map(tag => tag.key),
          environment: this.props.environments.map(env => env.name),
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
    const {participants} = this.props.group;

    if (!participants.length) {
      return null;
    }

    return (
      <SidebarSection.Wrap>
        <StyledSidebarSectionTitle>
          {t('Participants (%s)', participants.length)}
          <QuestionTooltip
            size="sm"
            position="top"
            color="gray200"
            title={t('People who have resolved, ignored, or added a comment')}
          />
        </StyledSidebarSectionTitle>
        <SidebarSection.Content>
          <StyledAvatarList users={participants} avatarSize={28} maxVisibleAvatars={13} />
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }

  renderSeenByList() {
    const {seenBy} = this.props.group;
    const activeUser = ConfigStore.get('user');
    const displayUsers = seenBy.filter(user => activeUser.id !== user.id);

    if (!displayUsers.length) {
      return null;
    }

    return (
      <SidebarSection.Wrap>
        <StyledSidebarSectionTitle>
          {t('Viewers (%s)', displayUsers.length)}{' '}
          <QuestionTooltip
            size="sm"
            position="top"
            color="gray200"
            title={t('People who have viewed this issue')}
          />
        </StyledSidebarSectionTitle>
        <SidebarSection.Content>
          <StyledAvatarList
            users={displayUsers}
            avatarSize={28}
            maxVisibleAvatars={13}
            renderTooltip={user => (
              <Fragment>
                {userDisplayName(user)}
                <br />
                <DateTime date={(user as AvatarUser).lastSeen} />
              </Fragment>
            )}
          />
        </SidebarSection.Content>
      </SidebarSection.Wrap>
    );
  }

  render() {
    const {event, group, organization, project, environments} = this.props;
    const {allEnvironmentsGroupData, currentRelease, tagsWithTopValues} = this.state;
    const projectId = project.slug;
    const hasIssueActionsV2 = organization.features.includes('issue-actions-v2');

    return (
      <Container>
        {!hasIssueActionsV2 && (
          <PageFiltersContainer>
            <EnvironmentPageFilter alignDropdown="right" />
          </PageFiltersContainer>
        )}

        <Feature
          organization={organization}
          features={['issue-details-tag-improvements']}
        >
          {isMobilePlatform(project.platform) && (
            <TagFacets
              environments={environments}
              groupId={group.id}
              tagKeys={MOBILE_TAGS}
              event={event}
              title={
                <Fragment>
                  {t('Mobile Tag Breakdown')} <FeatureBadge type="alpha" />
                </Fragment>
              }
              tagFormatter={MOBILE_TAGS_FORMATTER}
            />
          )}
        </Feature>

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
        {hasIssueActionsV2 && this.renderSeenByList()}
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

const StyledAvatarList = styled(AvatarList)`
  justify-content: flex-end;
  padding-left: ${space(0.75)};
`;

const StyledSidebarSectionTitle = styled(SidebarSection.Title)`
  gap: ${space(1)};
`;

const GroupSidebar = withApi(withRouter(BaseGroupSidebar));

export default GroupSidebar;
