import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import ButtonBar from 'sentry/components/buttonBar';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';

import {EventTags} from '../eventTags';

type Props = {
  event: Event;
  location: Location;
  organization: Organization;
  projectSlug: Project['slug'];
};

export enum TagFilter {
  ALL = 'All',
  CUSTOM = 'Custom',
  USER = 'User',
  SYSTEM = 'System',
  EVENT = 'Event',
}

function Tags({event, organization, projectSlug, location}: Props) {
  const [tagFilter, setTagFilter] = useState<TagFilter>(TagFilter.ALL);
  const handleTagFilterChange = useCallback((value: TagFilter) => {
    setTagFilter(value);
  }, []);

  return (
    <StyledEventDataSection
      title={t('Tags')}
      help={t('The default and custom tags associated with this event.')}
      actions={
        <ButtonBar gap={1}>
          <SegmentedControl
            size="xs"
            aria-label={t('Filter tags')}
            value={tagFilter}
            onChange={handleTagFilterChange}
          >
            {Object.values(TagFilter).map(v => (
              <SegmentedControl.Item key={v}>{`${v}`}</SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </ButtonBar>
      }
      data-test-id="event-tags"
      guideTarget="tags"
      type="tags"
    >
      <EventTags
        event={event}
        tagFilter={tagFilter}
        organization={organization}
        projectSlug={projectSlug}
        location={location}
      />
    </StyledEventDataSection>
  );
}

export default Tags;

const StyledEventDataSection = styled(EventDataSection)`
  padding: ${space(0.5)} ${space(2)} ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(1)} ${space(4)} ${space(1.5)};
  }
`;
