import {Component, Fragment} from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import AssigneeSelector from 'sentry/components/assigneeSelector';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Badge from 'sentry/components/badge';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import Count from 'sentry/components/count';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import ErrorLevel from 'sentry/components/events/errorLevel';
import EventAnnotation from 'sentry/components/events/eventAnnotation';
import EventMessage from 'sentry/components/events/eventMessage';
import FeatureBadge from 'sentry/components/featureBadge';
import InboxReason from 'sentry/components/group/inboxBadges/inboxReason';
import UnhandledInboxTag from 'sentry/components/group/inboxBadges/unhandledTag';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import SeenByList from 'sentry/components/seenByList';
import ShortId from 'sentry/components/shortId';
import Tooltip from 'sentry/components/tooltip';
import {IconChat} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, IssueCategory, Organization, Project, User} from 'sentry/types';
import {Event} from 'sentry/types/event';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getUtcDateString} from 'sentry/utils/dates';
import {getMessage} from 'sentry/utils/events';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

import GroupActions from './actions';
import {Tab} from './types';
import {TagAndMessageWrapper} from './unhandledTag';
import {ReprocessingStatus} from './utils';

type Props = WithRouterProps & {
  api: Client;
  baseUrl: string;
  currentTab: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  organization: Organization;
  project: Project;
  replaysCount: number | undefined;
  event?: Event;
};

type State = {
  memberList?: User[];
};

class GroupHeader extends Component<Props, State> {
  state: State = {};

  componentDidMount() {
    const {group, api, organization} = this.props;
    const {project} = group;

    if (!this.hasIssueDetailsOwners()) {
      fetchOrgMembers(api, organization.slug, [project.id]).then(memberList => {
        const users = memberList.map(member => member.user);
        this.setState({memberList: users});
      });
    }
  }

  trackAssign: React.ComponentProps<typeof AssigneeSelector>['onAssign'] = () => {
    const {group, project, organization, location} = this.props;
    const {alert_date, alert_rule_id, alert_type} = location.query;
    trackAdvancedAnalyticsEvent('issue_details.action_clicked', {
      organization,
      project_id: parseInt(project.id, 10),
      group_id: parseInt(group.id, 10),
      issue_category: group.issueCategory,
      action_type: 'assign',
      // Alert properties track if the user came from email/slack alerts
      alert_date:
        typeof alert_date === 'string' ? getUtcDateString(Number(alert_date)) : undefined,
      alert_rule_id: typeof alert_rule_id === 'string' ? alert_rule_id : undefined,
      alert_type: typeof alert_type === 'string' ? alert_type : undefined,
    });
  };

  hasIssueDetailsOwners() {
    return this.props.organization.features.includes('issue-details-owners');
  }

  getDisabledTabs() {
    const {organization} = this.props;

    const hasReprocessingV2Feature = organization.features.includes('reprocessing-v2');

    if (!hasReprocessingV2Feature) {
      return [];
    }

    const {groupReprocessingStatus} = this.props;

    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSING) {
      return [
        Tab.ACTIVITY,
        Tab.USER_FEEDBACK,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.GROUPING,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
      ];
    }

    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT) {
      return [
        Tab.DETAILS,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.GROUPING,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
        Tab.USER_FEEDBACK,
      ];
    }

    return [];
  }

  tabClickAnalyticsEvent(tab: Tab) {
    const {organization, group, project} = this.props;
    trackAdvancedAnalyticsEvent('issue_details.tab_changed', {
      organization,
      group_id: parseInt(group.id, 10),
      issue_category: group.issueCategory,
      project_id: parseInt(project.id, 10),
      tab,
    });
  }

  getErrorIssueTabs() {
    const {baseUrl, currentTab, project, organization, group, location, replaysCount} =
      this.props;
    const disabledTabs = this.getDisabledTabs();

    const projectFeatures = new Set(project ? project.features : []);
    const organizationFeatures = new Set(organization ? organization.features : []);

    const hasGroupingTreeUI = organizationFeatures.has('grouping-tree-ui');
    const hasSimilarView = projectFeatures.has('similarity-view');
    const hasEventAttachments = organizationFeatures.has('event-attachments');

    const searchTermWithoutQuery = omit(location.query, 'query');
    const eventRouteToObject = {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };

    return (
      <Fragment>
        <ListLink
          to={`${baseUrl}${location.search}`}
          isActive={() => currentTab === Tab.DETAILS}
          disabled={disabledTabs.includes(Tab.DETAILS)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.DETAILS)}
        >
          {t('Details')}
        </ListLink>
        <ListLink
          to={`${baseUrl}activity/${location.search}`}
          isActive={() => currentTab === Tab.ACTIVITY}
          disabled={disabledTabs.includes(Tab.ACTIVITY)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.ACTIVITY)}
        >
          {t('Activity')}
          <IconBadge>
            {group.numComments}
            <IconChat size="xs" />
          </IconBadge>
        </ListLink>
        <ListLink
          to={`${baseUrl}feedback/${location.search}`}
          isActive={() => currentTab === Tab.USER_FEEDBACK}
          disabled={disabledTabs.includes(Tab.USER_FEEDBACK)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.USER_FEEDBACK)}
        >
          {t('User Feedback')} <Badge text={group.userReportCount} />
        </ListLink>
        {hasEventAttachments && (
          <ListLink
            to={`${baseUrl}attachments/${location.search}`}
            isActive={() => currentTab === Tab.ATTACHMENTS}
            disabled={disabledTabs.includes(Tab.ATTACHMENTS)}
            onClick={() => this.tabClickAnalyticsEvent(Tab.ATTACHMENTS)}
          >
            {t('Attachments')}
          </ListLink>
        )}
        <ListLink
          to={`${baseUrl}tags/${location.search}`}
          isActive={() => currentTab === Tab.TAGS}
          disabled={disabledTabs.includes(Tab.TAGS)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.TAGS)}
        >
          {t('Tags')}
        </ListLink>
        <ListLink
          to={eventRouteToObject}
          isActive={() => currentTab === Tab.EVENTS}
          disabled={disabledTabs.includes(Tab.EVENTS)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.EVENTS)}
        >
          {t('Events')}
        </ListLink>
        <ListLink
          to={`${baseUrl}merged/${location.search}`}
          isActive={() => currentTab === Tab.MERGED}
          disabled={disabledTabs.includes(Tab.MERGED)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.MERGED)}
        >
          {t('Merged Issues')}
        </ListLink>
        {hasGroupingTreeUI && (
          <ListLink
            to={`${baseUrl}grouping/${location.search}`}
            isActive={() => currentTab === Tab.GROUPING}
            disabled={disabledTabs.includes(Tab.GROUPING)}
            onClick={() => this.tabClickAnalyticsEvent(Tab.GROUPING)}
          >
            {t('Grouping')}
          </ListLink>
        )}
        {hasSimilarView && (
          <ListLink
            to={`${baseUrl}similar/${location.search}`}
            isActive={() => currentTab === Tab.SIMILAR_ISSUES}
            disabled={disabledTabs.includes(Tab.SIMILAR_ISSUES)}
            onClick={() => this.tabClickAnalyticsEvent(Tab.SIMILAR_ISSUES)}
          >
            {t('Similar Issues')}
          </ListLink>
        )}
        <Feature features={['session-replay-ui']} organization={organization}>
          <ListLink
            to={`${baseUrl}replays/${location.search}`}
            isActive={() => currentTab === Tab.REPLAYS}
            onClick={() => this.tabClickAnalyticsEvent(Tab.REPLAYS)}
          >
            {t('Replays')}{' '}
            {replaysCount !== undefined ? <Badge text={replaysCount} /> : null}
            <ReplaysFeatureBadge noTooltip />
          </ListLink>
        </Feature>
      </Fragment>
    );
  }

  getPerformanceIssueTabs() {
    const {baseUrl, currentTab, location, group} = this.props;

    const disabledTabs = this.getDisabledTabs();

    const searchTermWithoutQuery = omit(location.query, 'query');
    const eventRouteToObject = {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };

    return (
      <Fragment>
        <ListLink
          to={`${baseUrl}${location.search}`}
          isActive={() => currentTab === Tab.DETAILS}
          disabled={disabledTabs.includes(Tab.DETAILS)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.DETAILS)}
        >
          {t('Details')}
        </ListLink>
        <ListLink
          to={`${baseUrl}activity/${location.search}`}
          isActive={() => currentTab === Tab.ACTIVITY}
          disabled={disabledTabs.includes(Tab.ACTIVITY)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.ACTIVITY)}
        >
          {t('Activity')}
          <IconBadge>
            {group.numComments}
            <IconChat size="xs" />
          </IconBadge>
        </ListLink>
        <ListLink
          to={`${baseUrl}tags/${location.search}`}
          isActive={() => currentTab === Tab.TAGS}
          disabled={disabledTabs.includes(Tab.TAGS)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.TAGS)}
        >
          {t('Tags')}
        </ListLink>
        <ListLink
          to={eventRouteToObject}
          isActive={() => currentTab === Tab.EVENTS}
          disabled={disabledTabs.includes(Tab.EVENTS)}
          onClick={() => this.tabClickAnalyticsEvent(Tab.EVENTS)}
        >
          {t('Events')}
        </ListLink>
      </Fragment>
    );
  }

  render() {
    const {project, group, baseUrl, event, organization, location} = this.props;
    const {memberList} = this.state;

    const {userCount} = group;

    let className = 'group-detail';

    if (group.hasSeen) {
      className += ' hasSeen';
    }

    if (group.status === 'resolved') {
      className += ' isResolved';
    }

    const message = getMessage(group);

    const searchTermWithoutQuery = omit(location.query, 'query');
    const eventRouteToObject = {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };

    const disabledTabs = this.getDisabledTabs();
    const disableActions = !!disabledTabs.length;

    const shortIdBreadCrumb = group.shortId && (
      <GuideAnchor target="issue_number" position="bottom">
        <ShortIdBreadrcumb>
          <ProjectBadge
            project={project}
            avatarSize={16}
            hideName
            avatarProps={{hasTooltip: true, tooltip: project.slug}}
          />
          <Tooltip
            className="help-link"
            title={t(
              'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
            )}
            position="bottom"
          >
            <StyledShortId shortId={group.shortId} />
          </Tooltip>
          {group.issueCategory === IssueCategory.PERFORMANCE && (
            <FeatureBadge
              type="beta"
              title="Performance issues are available for early adopters and may change"
            />
          )}
        </ShortIdBreadrcumb>
      </GuideAnchor>
    );

    return (
      <Layout.Header>
        <div className={className}>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Issues',
                to: `/organizations/${organization.slug}/issues/${location.search}`,
              },
              {
                label: shortIdBreadCrumb,
              },
            ]}
          />
          <HeaderRow>
            <TitleWrapper>
              <TitleHeading>
                <h3>
                  <StyledEventOrGroupTitle hasGuideAnchor data={group} />
                </h3>
                {group.inbox && <InboxReason inbox={group.inbox} fontSize="md" />}
              </TitleHeading>
              <StyledTagAndMessageWrapper>
                {group.level && <ErrorLevel level={group.level} size="11px" />}
                {group.isUnhandled && <UnhandledInboxTag />}
                <EventMessage
                  message={message}
                  annotations={
                    group.logger && (
                      <EventAnnotation>
                        <Link
                          to={{
                            pathname: `/organizations/${organization.slug}/issues/`,
                            query: {query: 'logger:' + group.logger},
                          }}
                        >
                          {group.logger}
                        </Link>
                      </EventAnnotation>
                    )
                  }
                />
              </StyledTagAndMessageWrapper>
            </TitleWrapper>
            <StatsWrapper>
              <div className="count">
                <h6 className="nav-header">{t('Events')}</h6>
                <Link disabled={disableActions} to={eventRouteToObject}>
                  <Count className="count" value={group.count} />
                </Link>
              </div>
              <div className="count">
                <h6 className="nav-header">{t('Users')}</h6>
                {userCount !== 0 ? (
                  <Link
                    disabled={disableActions}
                    to={`${baseUrl}tags/user/${location.search}`}
                  >
                    <Count className="count" value={userCount} />
                  </Link>
                ) : (
                  <span>0</span>
                )}
              </div>
              {!this.hasIssueDetailsOwners() && (
                <div data-test-id="assigned-to">
                  <h6 className="nav-header">{t('Assignee')}</h6>
                  <AssigneeSelector
                    id={group.id}
                    memberList={memberList}
                    disabled={disableActions}
                    onAssign={this.trackAssign}
                  />
                </div>
              )}
            </StatsWrapper>
          </HeaderRow>
          <HeaderRow>
            <GroupActions
              group={group}
              project={project}
              disabled={disableActions}
              event={event}
              query={location.query}
            />
            <StyledSeenByList
              seenBy={group.seenBy}
              iconTooltip={t('People who have viewed this issue')}
            />
          </HeaderRow>
          <NavTabs>
            {group.issueCategory === IssueCategory.PERFORMANCE
              ? this.getPerformanceIssueTabs()
              : this.getErrorIssueTabs()}
          </NavTabs>
        </div>
      </Layout.Header>
    );
  }
}

export default withApi(withRouter(withOrganization(GroupHeader)));

const ShortIdBreadrcumb = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledShortId = styled(ShortId)`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const HeaderRow = styled('div')`
  display: flex;
  gap: ${space(2)};
  justify-content: space-between;
  margin-top: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
  }
`;

const TitleWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: 65%;
  }
`;

const TitleHeading = styled('div')`
  display: flex;
  line-height: 2;
  gap: ${space(1)};
`;

const StyledSeenByList = styled(SeenByList)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: inherit;
`;

const StatsWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, min-content);
  gap: calc(${space(3)} + ${space(3)});

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    justify-content: flex-end;
  }
`;

const StyledTagAndMessageWrapper = styled(TagAndMessageWrapper)`
  display: flex;
  gap: ${space(1)};
  justify-content: flex-start;
  line-height: 1.2;
`;

const IconBadge = styled(Badge)`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
