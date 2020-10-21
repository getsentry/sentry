import isEmpty from 'lodash/isEmpty';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Event} from 'app/types';
import EventDataSection from 'app/components/events/eventDataSection';
import {defined, generateQueryWithTag} from 'app/utils';
import {t} from 'app/locale';
import Pills from 'app/components/pills';
import space from 'app/styles/space';

import EventTagsPill from './eventTagsPill';

type Props = {
  event: Event;
  orgId: string;
  projectId: string;
  location: Location;
  hasQueryFeature: boolean;
};

const EventTags = ({
  event: {tags},
  orgId,
  projectId,
  location,
  hasQueryFeature,
}: Props) => {
  if (isEmpty(tags)) {
    return null;
  }

  const streamPath = `/organizations/${orgId}/issues/`;
  const releasesPath = `/organizations/${orgId}/releases/`;

  return (
    <StyledEventDataSection title={t('Tags')} type="tags">
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
    </StyledEventDataSection>
  );
};

export default EventTags;

const StyledEventDataSection = styled(EventDataSection)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: ${space(3)};
  }
`;
