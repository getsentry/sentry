import {Location} from 'history';

import Pills from 'app/components/pills';
import {Organization} from 'app/types';
import {Event} from 'app/types/event';
import {defined, generateQueryWithTag} from 'app/utils';

import EventTagsPill from './eventTagsPill';

type Props = {
  event: Event;
  organization: Organization;
  projectId: string;
  location: Location;
};

const EventTags = ({event: {tags = []}, organization, projectId, location}: Props) => {
  if (!tags.length) {
    return null;
  }

  const orgSlug = organization.slug;
  const streamPath = `/organizations/${orgSlug}/issues/`;
  const releasesPath = `/organizations/${orgSlug}/releases/`;

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
          releasesPath={releasesPath}
        />
      ))}
    </Pills>
  );
};

export default EventTags;
