import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import * as Layout from 'sentry/components/layouts/thirds';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useUser} from 'sentry/utils/useUser';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/activitySection';
import FirstLastSeenSection from 'sentry/views/issueDetails/streamline/firstLastSeenSection';
import PeopleSection from 'sentry/views/issueDetails/streamline/peopleSection';
import {MergedIssuesSidebarSection} from 'sentry/views/issueDetails/streamline/sidebar/mergedSidebarSection';
import {SimilarIssuesSidebarSection} from 'sentry/views/issueDetails/streamline/sidebar/similarIssuesSidebarSection';
import SolutionsSection from 'sentry/views/issueDetails/streamline/solutionsSection';

type Props = {
  group: Group;
  project: Project;
  event?: Event;
};

export default function StreamlinedSidebar({group, event, project}: Props) {
  const activeUser = useUser();

  const {userParticipants, teamParticipants, viewers} = useMemo(() => {
    return {
      userParticipants: group.participants.filter(
        (p): p is UserParticipant => p.type === 'user'
      ),
      teamParticipants: group.participants.filter(
        (p): p is TeamParticipant => p.type === 'team'
      ),
      viewers: group.seenBy.filter(user => activeUser.id !== user.id),
    };
  }, [group, activeUser.id]);

  const showPeopleSection = group.participants.length > 0 || viewers.length > 0;

  return (
    <Side>
      <SolutionsSection group={group} project={project} event={event} />
      <StyledBreak />
      <FirstLastSeenSection group={group} />
      <StyledBreak />
      {event && (
        <ErrorBoundary mini>
          <StreamlinedExternalIssueList group={group} event={event} project={project} />
          <StyledBreak style={{marginBottom: space(0.5)}} />
        </ErrorBoundary>
      )}
      <StreamlinedActivitySection group={group} />
      {showPeopleSection && (
        <Fragment>
          <StyledBreak />
          <PeopleSection
            userParticipants={userParticipants}
            teamParticipants={teamParticipants}
            viewers={viewers}
          />
        </Fragment>
      )}
      <StyledBreak />
      <SimilarIssuesSidebarSection />
      <StyledBreak />
      <MergedIssuesSidebarSection />
    </Side>
  );
}

const StyledBreak = styled('hr')`
  margin-top: ${space(1.5)};
  margin-bottom: ${space(1.5)};
  border-color: ${p => p.theme.border};
`;

export const SidebarSectionTitle = styled(SidebarSection.Title)`
  margin-bottom: ${space(1)};
  color: ${p => p.theme.headingColor};
`;

const Side = styled(Layout.Side)`
  position: relative;
  padding: ${space(1.5)} ${space(2)};
`;
