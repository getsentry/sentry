import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {StreamlinedExternalIssueList} from 'sentry/components/group/externalIssuesList/streamlinedExternalIssueList';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import StreamlinedActivitySection from 'sentry/views/issueDetails/streamline/activitySection';
import FirstLastSeenSection from 'sentry/views/issueDetails/streamline/firstLastSeenSection';
import PeopleSection from 'sentry/views/issueDetails/streamline/peopleSection';
import {MergedIssuesSidebarSection} from 'sentry/views/issueDetails/streamline/sidebar/mergedSidebarSection';
import {SimilarIssuesSidebarSection} from 'sentry/views/issueDetails/streamline/sidebar/similarIssuesSidebarSection';

type Props = {
  group: Group;
  project: Project;
  event?: Event;
};

export default function StreamlinedSidebar({group, event, project}: Props) {
  return (
    <div>
      <FirstLastSeenSection group={group} />
      <StyledBreak />
      {event && (
        <ErrorBoundary mini>
          <StreamlinedExternalIssueList group={group} event={event} project={project} />
          <StyledBreak style={{marginBottom: space(0.5)}} />
        </ErrorBoundary>
      )}
      <StreamlinedActivitySection group={group} />
      <StyledBreak />
      <PeopleSection group={group} />
      <StyledBreak />
      <SimilarIssuesSidebarSection />
      <StyledBreak />
      <MergedIssuesSidebarSection />
    </div>
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
