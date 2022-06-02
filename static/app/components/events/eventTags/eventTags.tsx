import {Location} from 'history';

import Pills from 'sentry/components/pills';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined, generateQueryWithTag} from 'sentry/utils';

import EventTagsPill from './eventTagsPill';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
  projectId: string;
};

const EventTags = ({event: {tags = []}, organization, projectId, location}: Props) => {
  if (!tags.length) {
    return null;
  }

  const orgSlug = organization.slug;
  const streamPath = `/organizations/${orgSlug}/issues/`;

  return (
    <Pills>
      {tags.map((tag, index) => (
        <EventTagsPill
          key={!defined(tag.key) ? `tag-pill-${index}` : tag.key}
          tag={tag}
          projectId={projectId}
          organization={organization}
          query={generateQueryWithTag(location.query, tag)}
          streamPath={streamPath}
        />
      ))}
    </Pills>
  );
};

export default EventTags;
