import React from 'react';
import isEmpty from 'lodash/isEmpty';
import {Location} from 'history';

import {Event} from 'app/types';
import EventDataSection from 'app/components/events/eventDataSection';
import {generateQueryWithTag} from 'app/utils';
import {t} from 'app/locale';
import Pills from 'app/components/pills';
import {getMeta} from 'app/components/events/meta/metaProxy';

import EventTagsPill from './eventTagsPill';

type Props = {
  event: Event;
  orgId: string;
  projectId: string;
  location: Location;
  hideGuide?: boolean;
};

const EventTags = ({
  hideGuide = false,
  event: {tags},
  orgId,
  projectId,
  location,
}: Props) => {
  if (isEmpty(tags)) {
    return null;
  }

  const streamPath = `/organizations/${orgId}/issues/`;
  const releasesPath = `/organizations/${orgId}/releases/`;

  return (
    <EventDataSection
      title={t('Tags')}
      type="tags"
      className="p-b-1"
      hideGuide={hideGuide}
    >
      <Pills className="no-margin">
        {tags.map(tag => (
          <EventTagsPill
            key={tag.key}
            tag={tag}
            projectId={projectId}
            orgId={orgId}
            query={generateQueryWithTag(location.query, tag)}
            streamPath={streamPath}
            releasesPath={releasesPath}
            meta={getMeta(tag, 'value')}
          />
        ))}
      </Pills>
    </EventDataSection>
  );
};

export default EventTags;
