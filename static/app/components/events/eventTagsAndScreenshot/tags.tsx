import styled from '@emotion/styled';
import type {Location} from 'history';

import {SectionContents} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import type {Organization, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';

import {EventTags} from '../eventTags';

import DataSection from './dataSection';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
  projectSlug: Project['slug'];
};

function Tags({event, organization, projectSlug, location}: Props) {
  return (
    <StyledDataSection
      title={t('Tags')}
      description={t(
        'Tags help you quickly both access related events and view the tag distribution for a set of events'
      )}
      data-test-id="event-tags"
    >
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
  border-top: 0;
  overflow: hidden;
`;
