import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {DemoTourStep, SharedTourElement} from 'sentry/utils/demoMode/demoTours';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  IssueDetailsTour,
  IssueDetailsTourContext,
} from 'sentry/views/issueDetails/issueDetailsTour';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/sidebar/activitySection';
import {DetectorSection} from 'sentry/views/issueDetails/streamline/sidebar/detectorSection';
import {ExternalIssueSidebarList} from 'sentry/views/issueDetails/streamline/sidebar/externalIssueSidebarList';
import FirstLastSeenSection from 'sentry/views/issueDetails/streamline/sidebar/firstLastSeenSection';
import {MergedIssuesSidebarSection} from 'sentry/views/issueDetails/streamline/sidebar/mergedSidebarSection';
import PeopleSection from 'sentry/views/issueDetails/streamline/sidebar/peopleSection';
import SeerSection from 'sentry/views/issueDetails/streamline/sidebar/seerSection';
import {SimilarIssuesSidebarSection} from 'sentry/views/issueDetails/streamline/sidebar/similarIssuesSidebarSection';

type Props = {group: Group; project: Project; event?: Event};

export default function StreamlinedSidebar({group, event, project}: Props) {
  const theme = useTheme();
  const activeUser = useUser();
  const organization = useOrganization();
  const {isSidebarOpen} = useIssueDetails();

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
  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const isBottomSidebar = useMedia(`(max-width: ${theme.breakpoints.lg})`);
  const shouldDisplaySidebar = isSidebarOpen || isBottomSidebar;

  if (!shouldDisplaySidebar) {
    return null;
  }

  return (
    <SharedTourElement<IssueDetailsTour>
      tourContext={IssueDetailsTourContext}
      id={IssueDetailsTour.SIDEBAR}
      demoTourId={DemoTourStep.ISSUES_DETAIL_SIDEBAR}
      title={t('Share updates')}
      description={t(
        'Leave a comment for a teammate or link your favorite ticketing system - this area helps you collaborate and track progress on the issue.'
      )}
      position={isBottomSidebar ? 'top' : 'left-start'}
    >
      <Side>
        <FirstLastSeenSection group={group} />
        <StyledBreak />
        {((organization.features.includes('gen-ai-features') &&
          issueTypeConfig.issueSummary.enabled &&
          !organization.hideAiFeatures) ||
          issueTypeConfig.resources) && (
          <ErrorBoundary mini>
            <SeerSection group={group} project={project} event={event} />
          </ErrorBoundary>
        )}
        {event && (
          <ErrorBoundary mini>
            <ExternalIssueSidebarList group={group} event={event} project={project} />
          </ErrorBoundary>
        )}
        <StreamlinedActivitySection group={group} />
        {showPeopleSection && (
          <PeopleSection
            userParticipants={userParticipants}
            teamParticipants={teamParticipants}
            viewers={viewers}
          />
        )}
        {issueTypeConfig.similarIssues.enabled && (
          <Fragment>
            <SimilarIssuesSidebarSection />
            <StyledBreak />
          </Fragment>
        )}
        {issueTypeConfig.mergedIssues.enabled && (
          <Fragment>
            <MergedIssuesSidebarSection />
            <StyledBreak />
          </Fragment>
        )}
        {issueTypeConfig.detector.enabled && (
          <DetectorSection group={group} project={project} />
        )}
      </Side>
    </SharedTourElement>
  );
}

const StyledBreak = styled('hr')`
  margin-top: ${space(1.5)};
  margin-bottom: ${space(1.5)};
  border-color: ${p => p.theme.border};
`;

export const SidebarSectionTitle = styled(SidebarSection.Title)`
  margin-bottom: ${space(1)};
  color: ${p => p.theme.tokens.content.primary};
`;

const Side = styled(Layout.Side)`
  position: relative;
  padding: ${space(1.5)} ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    border-top: 1px solid ${p => p.theme.border};
  }

  > div {
    margin-left: ${p => p.theme.space.xl};
  }

  > [data-disclosure] {
    margin-left: calc(-${p => p.theme.space.lg} + 2px);
  }
`;
