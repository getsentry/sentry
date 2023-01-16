import styled from '@emotion/styled';
import type {Location} from 'history';

import EventContextSummary from 'sentry/components/events/contextSummary';
import {SectionContents} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import type {Organization, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';

import {EventTags} from '../eventTags';

import {DataSection} from './dataSection';

type Props = {
  event: Event;
  hasEventContext: boolean;
  location: Location;
  organization: Organization;
  projectSlug: Project['slug'];
};

function Tags({event, organization, projectSlug, location, hasEventContext}: Props) {
  return (
    <StyledDataSection
      title={t('Tags')}
      description={t('The default and custom tags associated with this event')}
      data-test-id="event-tags"
    >
      {hasEventContext && <EventContextSummary event={event} />}
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
  ${SectionContents} {
    overflow: hidden;
  }
`;
