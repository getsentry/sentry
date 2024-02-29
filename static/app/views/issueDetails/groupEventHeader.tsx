import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import GlobalAppStoreConnectUpdateAlert from 'sentry/components/globalAppStoreConnectUpdateAlert';
import {space} from 'sentry/styles/space';
import type {Event, Group, Project} from 'sentry/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useOrganization from 'sentry/utils/useOrganization';
import {GroupEventCarousel} from 'sentry/views/issueDetails/groupEventCarousel';
import {TraceTimeline} from 'sentry/views/issueDetails/traceTimeline/traceTimeline';

type GroupEventHeaderProps = {
  event: Event;
  group: Group;
  project: Project;
};

function GroupEventHeader({event, group, project}: GroupEventHeaderProps) {
  const organization = useOrganization();
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  return (
    <StyledDataSection>
      <GroupEventCarousel group={group} event={event} projectSlug={project.slug} />
      {issueTypeConfig.traceTimeline && <TraceTimeline event={event} />}
      <StyledGlobalAppStoreConnectUpdateAlert
        project={project}
        organization={organization}
      />
    </StyledDataSection>
  );
}

const StyledGlobalAppStoreConnectUpdateAlert = styled(GlobalAppStoreConnectUpdateAlert)`
  margin: ${space(0.5)} 0;
`;

const StyledDataSection = styled(DataSection)`
  padding: ${space(1)} ${space(2)} 0;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(1.5)} ${space(4)} 0;
  }
`;

export default GroupEventHeader;
