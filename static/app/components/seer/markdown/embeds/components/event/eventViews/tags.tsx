import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {EmbedSection} from 'sentry/components/seer/markdown/embeds/components/embedSection';
import {
  EventTagsRendererMap,
  type EventTagRendererExtra,
} from 'sentry/components/seer/markdown/embeds/components/event/eventViews/eventTagRenderers';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  INERT_LOCATION,
  INERT_NAVIGATE,
} from 'sentry/components/seer/markdown/embeds/inertRouting';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {
  TraceItemDetailsMeta,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';

/**
 * Dropped from the tree the way issue details drops it: the replay is its own
 * embed, and the bare id is not something to read.
 */
const HIDDEN_TAG_KEYS = ['replayId'];

interface EventTagsViewProps {
  /** Link to the issue's tag distributions page. Derived once by the block. */
  distributionsHref: string;
  event: Event;
}

/**
 * The event serves its tag meta positionally -- `_meta.tags[2]` annotates
 * `tags[2]` -- while the tree looks meta up by key. Re-key it on the way in, so
 * a scrubbed value carries the same annotation here as it does on a log.
 */
function toTraceItemMeta(event: Event): TraceItemDetailsMeta {
  const tagsMeta = event._meta?.tags as
    | Record<string, {value?: Record<string, Meta>} | undefined>
    | undefined;

  if (!tagsMeta) {
    return {};
  }

  return Object.fromEntries(
    (event.tags ?? []).flatMap((tag, index) => {
      const valueMeta = tagsMeta[index]?.value?.[''];
      return valueMeta ? [[tag.key, {meta: {value: {'': valueMeta}}}]] : [];
    })
  );
}

/**
 * Every tag on the event, as the same tree the log embed renders its attributes
 * in. Deliberately not `EventTags`: that one picks its own column count off the
 * container, fetches the detailed project to render a row, and reports mobile
 * device classifications to analytics -- three things an embed of a single event
 * should not be doing, and none of which the tree here needs.
 */
export function EventTagsView({event, distributionsHref}: EventTagsViewProps) {
  const organization = useOrganization();
  const theme = useTheme();

  const attributes = useMemo<TraceItemResponseAttribute[]>(
    () =>
      (event.tags ?? [])
        .filter(tag => !HIDDEN_TAG_KEYS.includes(tag.key))
        .map(tag => ({name: tag.key, type: 'str' as const, value: tag.value ?? ''}))
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    [event.tags]
  );

  const rendererExtra = useMemo<EventTagRendererExtra>(
    () => ({
      location: INERT_LOCATION,
      navigate: INERT_NAVIGATE,
      organization,
      projectId: event.projectID,
      projectSlug: event.projectSlug,
      theme,
      traceItemMeta: toTraceItemMeta(event),
    }),
    [event, organization, theme]
  );

  return (
    <EmbedSection
      title={t('Tags')}
      action={
        <ResourceLink
          icon={IconIssues}
          href={distributionsHref}
          title={t('All tags for this issue')}
        />
      }
    >
      {attributes.length === 0 ? (
        <Text variant="muted">{t('This event has no tags.')}</Text>
      ) : (
        <Container data-test-id="seer-event-tags" width="100%">
          <AttributesTree<EventTagRendererExtra>
            attributes={attributes}
            // A single column keeps the tree readable at the width Seer renders in.
            columnCount={1}
            // The row actions filter the page the tree normally lives in, which
            // an embed has no query params to write to.
            config={{disableActions: true}}
            renderers={EventTagsRendererMap}
            rendererExtra={rendererExtra}
          />
        </Container>
      )}
    </EmbedSection>
  );
}
