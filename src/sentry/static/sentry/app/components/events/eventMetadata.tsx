import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Event, OrganizationSummary} from 'app/types';
import {SectionHeading} from 'app/components/charts/styles';
import DateTime from 'app/components/dateTime';
import ExternalLink from 'app/components/links/externalLink';
import FileSize from 'app/components/fileSize';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import space from 'app/styles/space';
import getDynamicText from 'app/utils/getDynamicText';
import Projects from 'app/utils/projects';

type Props = {
  event: Event;
  organization: OrganizationSummary;
  projectId: string;
};

/**
 * Render metadata about the event and provide a link to the JSON blob.
 * Used in the sidebar of performance event details and discover2 event details.
 */
function EventMetadata({event, organization, projectId}: Props) {
  const eventJsonUrl = `/api/0/projects/${organization.slug}/${projectId}/events/${event.eventID}/json/`;

  return (
    <MetaDataID>
      <SectionHeading>{t('Event ID')}</SectionHeading>
      <MetadataContainer data-test-id="event-id">{event.eventID}</MetadataContainer>
      <MetadataContainer>
        <DateTime
          date={getDynamicText({
            value: event.dateCreated || (event.endTimestamp || 0) * 1000,
            fixed: 'Dummy timestamp',
          })}
        />
      </MetadataContainer>
      <Projects orgId={organization.slug} slugs={[projectId]}>
        {({projects}) => {
          const project = projects.find(p => p.slug === projectId);
          return (
            <StyledProjectBadge
              project={project ? project : {slug: projectId}}
              avatarSize={16}
            />
          );
        }}
      </Projects>
      <MetadataJSON href={eventJsonUrl} className="json-link">
        {t('Preview JSON')} (<FileSize bytes={event.size} />)
      </MetadataJSON>
    </MetaDataID>
  );
}

const MetaDataID = styled('div')`
  margin-bottom: ${space(4)};
`;

const MetadataContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const MetadataJSON = styled(ExternalLink)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledProjectBadge = styled(ProjectBadge)`
  margin-bottom: ${space(2)};
`;

export default EventMetadata;
