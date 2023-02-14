import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import DateTime from 'sentry/components/dateTime';
import FileSize from 'sentry/components/fileSize';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OrganizationSummary} from 'sentry/types';
import {Event} from 'sentry/types/event';
import getDynamicText from 'sentry/utils/getDynamicText';
import Projects from 'sentry/utils/projects';

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
  font-size: ${p => p.theme.fontSizeMedium};
`;

const MetadataJSON = styled(ExternalLink)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StyledProjectBadge = styled(ProjectBadge)`
  margin-bottom: ${space(2)};
`;

export default EventMetadata;
