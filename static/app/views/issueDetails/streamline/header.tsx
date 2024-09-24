import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import Count from 'sentry/components/count';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {GroupSummaryHeader} from 'sentry/components/group/groupSummary';
import ParticipantList from 'sentry/components/group/streamlinedParticipantList';
import Link from 'sentry/components/links/link';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import GroupActions from 'sentry/views/issueDetails/actions/index';
import {Divider} from 'sentry/views/issueDetails/divider';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderTabs} from 'sentry/views/issueDetails/header';
import {AttachmentsBadge} from 'sentry/views/issueDetails/streamline/attachmentsBadge';
import {useIssueDetailsHeader} from 'sentry/views/issueDetails/useIssueDetailsHeader';
import type {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

interface GroupRelease {
  firstRelease: Release;
  lastRelease: Release;
}

interface GroupHeaderProps {
  baseUrl: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  project: Project;
  event?: Event;
}

export default function StreamlinedGroupHeader({
  group,
  project,
  baseUrl,
  groupReprocessingStatus,
  event,
}: GroupHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {sort: _sort, ...query} = location.query;

  const {data: groupReleaseData} = useApiQuery<GroupRelease>(
    [`/organizations/${organization.slug}/issues/${group.id}/first-last-release/`],
    {
      staleTime: 30000,
      gcTime: 30000,
    }
  );

  const {count: eventCount, userCount} = group;
  const {firstRelease, lastRelease} = groupReleaseData || {};

  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    organization,
    group,
  });

  const {disabledTabs, message, eventRoute, disableActions, shortIdBreadcrumb} =
    useIssueDetailsHeader({
      group,
      groupReprocessingStatus,
      baseUrl,
      project,
    });

  const activeUser = ConfigStore.get('user');

  const {userParticipants, teamParticipants, displayUsers} = useMemo(() => {
    return {
      userParticipants: group.participants.filter(
        (p): p is UserParticipant => p.type === 'user'
      ),
      teamParticipants: group.participants.filter(
        (p): p is TeamParticipant => p.type === 'team'
      ),
      displayUsers: group.seenBy.filter(user => activeUser.id !== user.id),
    };
  }, [group, activeUser.id]);

  return (
    <Header>
      <StyledBreadcrumbs
        crumbs={[
          {
            label: 'Issues',
            to: {
              pathname: `/organizations/${organization.slug}/issues/`,
              query: query,
            },
          },
          {label: shortIdBreadcrumb},
        ]}
      />
      <HeadingGrid>
        <Heading>
          <TitleHeading>
            <TitleWrapper>
              <StyledEventOrGroupTitle data={group} />
            </TitleWrapper>
          </TitleHeading>
          <MessageWrapper>
            <EventMessage
              message={message}
              type={group.type}
              level={group.level}
              showUnhandled={group.isUnhandled}
            />
            {firstRelease && lastRelease && (
              <Fragment>
                <Divider />
                <ReleaseWrapper>
                  {firstRelease.id === lastRelease.id ? t('Release') : t('Releases')}
                  <VersionHoverCard
                    organization={organization}
                    projectSlug={project.slug}
                    releaseVersion={firstRelease.version}
                  >
                    <Version
                      version={firstRelease.version}
                      projectId={project.id}
                      truncate
                    />
                  </VersionHoverCard>
                  {firstRelease.id === lastRelease.id ? null : (
                    <Fragment>
                      -
                      <VersionHoverCard
                        organization={organization}
                        projectSlug={project.slug}
                        releaseVersion={lastRelease.version}
                      >
                        <Version
                          version={lastRelease.version}
                          projectId={project.id}
                          truncate
                        />
                      </VersionHoverCard>
                    </Fragment>
                  )}
                </ReleaseWrapper>
              </Fragment>
            )}
            <AttachmentsBadge group={group} project={project} />
          </MessageWrapper>
          <Feature features={['organizations:ai-summary']}>
            <GroupSummaryHeader groupId={group.id} groupCategory={group.issueCategory} />
          </Feature>
        </Heading>
        <AllStats>
          <Stat>
            <Label data-test-id="all-event-count">{t('All Events')}</Label>
            <Link disabled={disableActions} to={eventRoute}>
              <StatCount value={eventCount} />
            </Link>
          </Stat>
          <Stat>
            <Label>{t('All Users')}</Label>
            <Link disabled={disableActions} to={`${baseUrl}tags/user/${location.search}`}>
              <StatCount value={userCount} />
            </Link>
          </Stat>
        </AllStats>
      </HeadingGrid>

      <StyledBreak />
      <InfoWrapper
        isResolvedOrIgnored={group.status === 'resolved' || group.status === 'ignored'}
      >
        <GroupActions
          group={group}
          project={project}
          disabled={disableActions}
          event={event}
          query={location.query}
        />
        <PriorityWorkflowWrapper>
          <Wrapper>
            {t('Priority')}
            <GroupPriority group={group} />
          </Wrapper>
          <Wrapper>
            {t('Assignee')}
            <AssigneeSelector
              group={group}
              assigneeLoading={assigneeLoading}
              handleAssigneeChange={handleAssigneeChange}
            />
          </Wrapper>
          {group.participants.length > 0 && (
            <Wrapper>
              {t('Participants')}
              <ParticipantList users={userParticipants} teams={teamParticipants} />
            </Wrapper>
          )}
          {displayUsers.length > 0 && (
            <Wrapper>
              {t('Viewers')}
              <ParticipantList users={displayUsers} />
            </Wrapper>
          )}
        </PriorityWorkflowWrapper>
      </InfoWrapper>
      <div>
        <GroupHeaderTabs {...{baseUrl, disabledTabs, eventRoute, group, project}} />
      </div>
    </Header>
  );
}

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: inherit;
`;

const HeadingGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${space(2)};
  align-items: center;
`;

const Heading = styled('div')``;

const AllStats = styled('div')`
  display: flex;
  gap: ${space(4)};
`;

const Stat = styled('div')`
  display: inline-block;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Label = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
`;

const StatCount = styled(Count)`
  font-size: ${p => p.theme.headerFontSize};
  display: block;
`;

const TitleWrapper = styled('h3')`
  font-size: ${p => p.theme.headerFontSize};
  margin: 0 0 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  color: ${p => p.theme.headingColor};

  & em {
    font-weight: ${p => p.theme.fontWeightNormal};
    color: ${p => p.theme.textColor};
    font-size: 90%;
  }
`;

const TitleHeading = styled('div')`
  display: flex;
  line-height: 2;
  gap: ${space(1)};
  padding-top: ${space(1)};
`;

const StyledBreak = styled('hr')`
  margin-top: ${space(2)};
  margin-bottom: 0;
  margin-right: 0;
  border-color: ${p => p.theme.border};
`;

const MessageWrapper = styled('div')`
  display: flex;
  color: ${p => p.theme.gray300};
  gap: ${space(1)};
`;

const InfoWrapper = styled('div')<{isResolvedOrIgnored: boolean}>`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  background: ${p =>
    p.isResolvedOrIgnored
      ? `linear-gradient(to right, ${p.theme.background}, ${Color(p.theme.success).lighten(0.5).alpha(0.15).string()})`
      : p.theme.background};
  color: ${p => p.theme.gray300};
  padding: ${space(1)} 24px;
  margin-right: 0;
  margin-left: 0;
  flex-wrap: wrap;
`;

const PriorityWorkflowWrapper = styled('div')`
  display: flex;
  column-gap: ${space(2)};
  flex-wrap: wrap;
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ReleaseWrapper = styled('div')`
  display: flex;
  align-items: center;
  max-width: 40%;
  gap: ${space(0.25)};
  a {
    color: ${p => p.theme.gray300};
    text-decoration: underline;
    text-decoration-style: dotted;
  }
`;

const Header = styled('div')`
  background-color: ${p => p.theme.background};
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid ${p => p.theme.border};

  > * {
    margin-right: 24px;
    margin-left: 24px;
  }
`;

const StyledBreadcrumbs = styled(Breadcrumbs)`
  margin-top: ${space(2)};
`;
