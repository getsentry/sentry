import {useMemo, useState} from 'react';

import {Grid} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import {EventTags} from 'sentry/components/events/eventTags';
import {
  associateTagsWithMeta,
  getSentryDefaultTags,
  TagFilter,
  TagFilterData,
} from 'sentry/components/events/eventTags/util';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

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

  const [tagFilter, setTagFilter] = useState(TagFilter.ALL);
  const handleTagFilterChange = (value: TagFilter) => {
    setTagFilter(value);
  };

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
    <Grid flow="column" align="center" gap="md">
      {additionalActions}
      <SegmentedControl
        size="xs"
        aria-label={t('Filter tags')}
        value={tagFilter}
        onChange={handleTagFilterChange}
      >
        {[TagFilter.ALL, TagFilter.CUSTOM, ...availableFilters].map(v => (
          <SegmentedControl.Item key={v}>{v}</SegmentedControl.Item>
        ))}
      </SegmentedControl>
    </Grid>
  );

  return (
    <FoldSection
      disableCollapsePersistence={disableCollapsePersistence}
      title={
        <GuideAnchor target="tags" position="top">
          {t('Tags')}
        </GuideAnchor>
      }
      actions={actions}
      sectionKey={SectionKey.TAGS}
      ref={ref}
    >
      <EventTags
        event={event}
        projectSlug={projectSlug}
        tagFilter={tagFilter}
        filteredTags={filteredTags ?? []}
      />
    </FoldSection>
  );
}
