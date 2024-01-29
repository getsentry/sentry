import styled from '@emotion/styled';

import {DataSection} from 'sentry/components/events/styles';
import GlobalAppStoreConnectUpdateAlert from 'sentry/components/globalAppStoreConnectUpdateAlert';
import {space} from 'sentry/styles/space';
import type {Event, Group, Project} from 'sentry/types';
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

  return (
    <DataSection>
      <GroupEventCarousel group={group} event={event} projectSlug={project.slug} />
      <StyledGlobalAppStoreConnectUpdateAlert
        project={project}
        organization={organization}
      />
      <TraceTimeline event={event} />
    </DataSection>
  );
}

const StyledGlobalAppStoreConnectUpdateAlert = styled(GlobalAppStoreConnectUpdateAlert)`
  margin: ${space(0.5)} 0;
`;

export default GroupEventHeader;
