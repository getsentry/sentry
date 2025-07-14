import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {EventTags} from 'sentry/components/events/eventTags';
import {
  associateTagsWithMeta,
  getSentryDefaultTags,
  TagFilter,
  TagFilterData,
  TAGS_DOCS_LINK,
} from 'sentry/components/events/eventTags/util';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

type Props = {
  event: Event;
  projectSlug: Project['slug'];
  /**
   * Additional buttons to render in the header of the section
   */
  additionalActions?: React.ReactNode;
  disableCollapsePersistence?: boolean;
  ref?: React.Ref<HTMLDivElement>;
};

export function EventTagsDataSection({
  ref,
  event,
  projectSlug,
  additionalActions,
  disableCollapsePersistence,
}: Props) {
  const sentryTags = getSentryDefaultTags();

  const [tagFilter, setTagFilter] = useState<TagFilter>(TagFilter.ALL);
  const handleTagFilterChange = useCallback((value: TagFilter) => {
    setTagFilter(value);
  }, []);

  const tagsWithMeta = useMemo(() => {
    return associateTagsWithMeta({tags: event.tags, meta: event._meta?.tags});
  }, [event.tags, event._meta?.tags]);

  const filteredTags = useMemo(() => {
    switch (tagFilter) {
      case TagFilter.ALL:
        return tagsWithMeta;
      case TagFilter.CUSTOM:
        return tagsWithMeta.filter(tag => !sentryTags.has(tag.key));
      default:
        return tagsWithMeta.filter(tag => TagFilterData[tagFilter].has(tag.key));
    }
  }, [tagFilter, tagsWithMeta, sentryTags]);

  const availableFilters = useMemo(() => {
    return Object.keys(TagFilterData).filter(filter => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return event.tags.some(tag => TagFilterData[filter].has(tag.key));
    });
  }, [event.tags]);

  const actions = (
    <ButtonBar gap="md">
      {additionalActions}
      <SegmentedControl
        size="xs"
        aria-label={t('Filter tags')}
        value={tagFilter}
        onChange={handleTagFilterChange}
      >
        {[TagFilter.ALL, TagFilter.CUSTOM, ...availableFilters].map(v => (
          <SegmentedControl.Item key={v}>{`${v}`}</SegmentedControl.Item>
        ))}
      </SegmentedControl>
    </ButtonBar>
  );

  return (
    <StyledEventDataSection
      disableCollapsePersistence={disableCollapsePersistence}
      title={
        <GuideAnchor target="tags" position="top">
          {t('Tags')}
        </GuideAnchor>
      }
      help={tct('The searchable tags associated with this event. [link:Learn more]', {
        link: <ExternalLink openInNewTab href={TAGS_DOCS_LINK} />,
      })}
      isHelpHoverable
      actions={actions}
      data-test-id="event-tags"
      type={SectionKey.TAGS}
      ref={ref}
    >
      <EventTags
        event={event}
        projectSlug={projectSlug}
        tagFilter={tagFilter}
        filteredTags={filteredTags ?? []}
      />
    </StyledEventDataSection>
  );
}

const StyledEventDataSection = styled(InterimSection)`
  padding: ${space(0.5)} ${space(2)} ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(1)} ${space(4)} ${space(1.5)};
  }
`;
