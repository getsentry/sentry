import {Component, Fragment} from 'react';
import {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import isObject from 'lodash/isObject';

import {Client} from 'sentry/api';
import type {OnAssignCallback} from 'sentry/components/assigneeSelectorDropdown';
import AvatarList from 'sentry/components/avatar/avatarList';
import DateTime from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import AssignedTo from 'sentry/components/group/assignedTo';
import ExternalIssueList from 'sentry/components/group/externalIssuesList';
import OwnedBy from 'sentry/components/group/ownedBy';
import GroupReleaseStats from 'sentry/components/group/releaseStats';
import SuggestedOwners from 'sentry/components/group/suggestedOwners/suggestedOwners';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {Tooltip} from 'sentry/components/tooltip';
import {backend, frontend} from 'sentry/data/platformCategories';
import {IconQuestion} from 'sentry/icons/iconQuestion';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {
  AvatarUser,
  CurrentRelease,
  Environment,
  Group,
  Organization,
  Project,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {userDisplayName} from 'sentry/utils/formatters';
import {isMobilePlatform} from 'sentry/utils/platform';
import withApi from 'sentry/utils/withApi';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import TagFacets, {
  BACKEND_TAGS,
  DEFAULT_TAGS,
  FRONTEND_TAGS,
  MOBILE_TAGS,
  TAGS_FORMATTER,
} from './tagFacets';

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
};

class BaseGroupSidebar extends Component<Props, State> {
  state: State = {};

  componentDidMount() {
    this.fetchAllEnvironmentsGroupData();
    this.fetchCurrentRelease();
  }

  trackAssign: OnAssignCallback = (type, _assignee, suggestedAssignee) => {
    const {group, project, organization, location} = this.props;
    const {alert_date, alert_rule_id, alert_type} = location.query;
    trackAdvancedAnalyticsEvent('issue_details.action_clicked', {
      organization,
      project_id: parseInt(project.id, 10),
      action_type: 'assign',
      assigned_type: type,
      assigned_suggestion_reason: suggestedAssignee?.suggestedReason,
      alert_date:
        typeof alert_date === 'string' ? getUtcDateString(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined,
      ...getAnalyticsDataForGroup(group),
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
    const {allEnvironmentsGroupData, currentRelease} = this.state;
    const hasStreamlineTargetingFeature = organization.features.includes(
      'streamline-targeting-context'
    );

    return (
      <Container>
        {!hasStreamlineTargetingFeature && (
          <OwnedBy
            group={group}
            event={event}
            project={project}
            organization={organization}
          />
        )}
        <AssignedTo
          group={group}
          event={event}
          project={project}
          onAssign={this.trackAssign}
        />

        {!hasStreamlineTargetingFeature && event && (
          <SuggestedOwners project={project} group={group} event={event} />
        )}

        <GroupReleaseStats
          organization={organization}
          project={project}
          environments={environments}
          allEnvironments={allEnvironmentsGroupData}
          group={group}
          currentRelease={currentRelease}
        />

        {event && (
          <ErrorBoundary mini>
            <ExternalIssueList project={project} group={group} event={event} />
          </ErrorBoundary>
        )}

        {this.renderPluginIssue()}

        <TagFacets
          environments={environments}
          groupId={group.id}
          tagKeys={
            isMobilePlatform(project?.platform)
              ? !organization.features.includes('device-classification')
                ? MOBILE_TAGS.filter(tag => tag !== 'device.class')
                : MOBILE_TAGS
              : frontend.some(val => val === project?.platform)
              ? FRONTEND_TAGS
              : backend.some(val => val === project?.platform)
              ? BACKEND_TAGS
              : DEFAULT_TAGS
          }
          title={
            <div>
              {t('All Tags')}
              <TooltipWrapper>
                <Tooltip
                  title={t('The tags associated with all events in this issue')}
                  disableForVisualTest
                >
                  <IconQuestion size="sm" color="gray200" />
                </Tooltip>
              </TooltipWrapper>
            </div>
          }
          event={event}
          tagFormatter={TAGS_FORMATTER}
          project={project}
        />

        {this.renderParticipantData()}
        {this.renderSeenByList()}
      </Container>
    );
  }
}

const Container = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
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

const TooltipWrapper = styled('span')`
  vertical-align: middle;
  padding-left: ${space(0.5)};
`;

const GroupSidebar = withApi(withSentryRouter(BaseGroupSidebar));

export default GroupSidebar;
