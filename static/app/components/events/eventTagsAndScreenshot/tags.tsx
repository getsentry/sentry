import type {Location} from 'history';

import EventContextSummary from 'sentry/components/events/contextSummary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import type {Organization, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';

import {EventTags} from '../eventTags';

type Props = {
  event: Event;
  hasEventContext: boolean;
  location: Location;
  organization: Organization;
  projectSlug: Project['slug'];
};

function Tags({event, organization, projectSlug, location, hasEventContext}: Props) {
  return (
    <EventDataSection
      title={t('Tags')}
      help={t('The default and custom tags associated with this event')}
      data-test-id="event-tags"
      guideTarget="tags"
      type="tags"
    >
      {hasEventContext && <EventContextSummary event={event} />}
      <EventTags
        event={event}
        organization={organization}
        projectSlug={projectSlug}
        location={location}
      />
    </EventDataSection>
  );
}

export default Tags;
