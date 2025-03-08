import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {TourElement} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {
  IssueDetailsTour,
  IssueDetailsTourContext,
} from 'sentry/views/issueDetails/issueDetailsTour';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/sidebar/activitySection';
import {DetectorSection} from 'sentry/views/issueDetails/streamline/sidebar/detectorSection';
import {ExternalIssueList} from 'sentry/views/issueDetails/streamline/sidebar/externalIssueList';
import FirstLastSeenSection from 'sentry/views/issueDetails/streamline/sidebar/firstLastSeenSection';
import {MergedIssuesSidebarSection} from 'sentry/views/issueDetails/streamline/sidebar/mergedSidebarSection';
import PeopleSection from 'sentry/views/issueDetails/streamline/sidebar/peopleSection';
import {SimilarIssuesSidebarSection} from 'sentry/views/issueDetails/streamline/sidebar/similarIssuesSidebarSection';
import SolutionsSection from 'sentry/views/issueDetails/streamline/sidebar/solutionsSection';

type Props = {
  group: Group;
  project: Project;
  event?: Event;
};

export default function StreamlinedSidebar({group, event, project}: Props) {
  const theme = useTheme();
  const activeUser = useUser();
  const organization = useOrganization();

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
  const isScreenSmall = useMedia(`(max-width: ${theme.breakpoints.small})`);

  return (
    <TourElement<IssueDetailsTour>
      tourContext={IssueDetailsTourContext}
      id={IssueDetailsTour.SIDEBAR}
      title={t('Share updates')}
      description={t(
        'Leave a comment for a teammate or link your favorite ticketing system - this area helps you collaborate and track progress on the issue.'
      )}
      position={isScreenSmall ? 'top' : 'left-start'}
    >
      <Side>
        <GuideAnchor target="issue_sidebar_releases" position="left">
          <FirstLastSeenSection group={group} />
        </GuideAnchor>
        <StyledBreak />
        {((organization.features.includes('gen-ai-features') &&
          issueTypeConfig.issueSummary.enabled &&
          !organization.hideAiFeatures) ||
          issueTypeConfig.resources) && (
          <SolutionsSection group={group} project={project} event={event} />
        )}
        {event && (
          <ErrorBoundary mini>
            <ExternalIssueList group={group} event={event} project={project} />
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
        {issueTypeConfig.similarIssues.enabled && (
          <Fragment>
            <StyledBreak />
            <SimilarIssuesSidebarSection />
          </Fragment>
        )}
        {issueTypeConfig.mergedIssues.enabled && (
          <Fragment>
            <StyledBreak />
            <MergedIssuesSidebarSection />
          </Fragment>
        )}
        {issueTypeConfig.detector.enabled && (
          <Fragment>
            <StyledBreak />
            <DetectorSection group={group} project={project} />
          </Fragment>
        )}
      </Side>
    </TourElement>
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
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    border-top: 1px solid ${p => p.theme.border};
  }
`;
