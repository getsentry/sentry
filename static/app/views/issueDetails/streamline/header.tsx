import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import ParticipantList from 'sentry/components/group/streamlinedParticipantList';
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
      cacheTime: 30000,
    }
  );

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
                <Version version={firstRelease.version} projectId={project.id} truncate />
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
      </MessageWrapper>
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
      ? 'linear-gradient(to right, rgba(235, 250, 246, 0.2) , rgb(235, 250, 246))'
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
