import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEmpty from 'lodash/isEmpty';

import EventDataSection from 'app/components/events/eventDataSection';
import Pills from 'app/components/pills';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Event} from 'app/types/event';
import {defined, generateQueryWithTag} from 'app/utils';

import EventTagsPill from './eventTagsPill';

type Props = {
  event: Event;
  orgId: string;
  projectId: string;
  location: Location;
  hasQueryFeature: boolean;
  showSectionHeader?: boolean;
};

const EventTags = ({
  event: {tags, type},
  orgId,
  projectId,
  location,
  hasQueryFeature,
  showSectionHeader = true,
}: Props) => {
  if (isEmpty(tags)) {
    return null;
  }

  const streamPath =
    type === 'transaction'
      ? `/organizations/${orgId}/performance/summary/`
      : `/organizations/${orgId}/issues/`;
  const releasesPath = `/organizations/${orgId}/releases/`;

  const component = (
    <Pills>
      {tags.map((tag, index) => (
        <EventTagsPill
          key={!defined(tag.key) ? `tag-pill-${index}` : tag.key}
          tag={tag}
          projectId={projectId}
          orgId={orgId}
          location={location}
          query={generateQueryWithTag(location.query, tag)}
          streamPath={streamPath}
          releasesPath={releasesPath}
          hasQueryFeature={hasQueryFeature}
        />
      ))}
    </Pills>
  );

  if (showSectionHeader) {
    return (
      <StyledEventDataSection title={t('Tags')} type="tags">
        {component}
      </StyledEventDataSection>
    );
  }

  return component;
};

export default EventTags;

const StyledEventDataSection = styled(EventDataSection)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: ${space(3)};
  }
`;
