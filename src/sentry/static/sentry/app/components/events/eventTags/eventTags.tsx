import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEmpty from 'lodash/isEmpty';

import EventDataSection from 'app/components/events/eventDataSection';
import Pills from 'app/components/pills';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {Event} from 'app/types/event';
import {defined, generateQueryWithTag} from 'app/utils';

import EventTagsPill from './eventTagsPill';

type Props = {
  event: Event;
  organization: Organization;
  projectId: string;
  location: Location;
  hasQueryFeature: boolean;
};

const EventTags = ({
  event: {tags},
  organization,
  projectId,
  location,
  hasQueryFeature,
}: Props) => {
  if (isEmpty(tags)) {
    return null;
  }

  const orgSlug = organization.slug;
  const streamPath = `/organizations/${orgSlug}/issues/`;
  const releasesPath = `/organizations/${orgSlug}/releases/`;

  return (
    <StyledEventDataSection title={t('Tags')} type="tags">
      <Pills>
        {tags.map((tag, index) => (
          <EventTagsPill
            key={!defined(tag.key) ? `tag-pill-${index}` : tag.key}
            tag={tag}
            projectId={projectId}
            organization={organization}
            location={location}
            query={generateQueryWithTag(location.query, tag)}
            streamPath={streamPath}
            releasesPath={releasesPath}
            hasQueryFeature={hasQueryFeature}
          />
        ))}
      </Pills>
    </StyledEventDataSection>
  );
};

export default EventTags;

const StyledEventDataSection = styled(EventDataSection)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: ${space(3)};
  }
`;
