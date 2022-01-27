import styled from '@emotion/styled';
import {Location} from 'history';

import {SectionContents} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';

import EventTags from '../eventTags/eventTags';

import DataSection from './dataSection';
import TagsHighlight from './tagsHighlight';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: Project['slug'];
  location: Location;
  hasContext: boolean;
};

function Tags({event, organization, projectSlug, location, hasContext}: Props) {
  return (
    <StyledDataSection
      title={t('Tags')}
      description={t(
        'Tags help you quickly both access related events and view the tag distribution for a set of events'
      )}
      data-test-id="event-tags"
    >
      {hasContext && <TagsHighlight event={event} />}
      <EventTags
        event={event}
        organization={organization}
        projectId={projectSlug}
        location={location}
      />
    </StyledDataSection>
  );
}

export default Tags;

const StyledDataSection = styled(DataSection)`
  overflow: hidden;
  ${SectionContents} {
    overflow: hidden;
  }
`;
