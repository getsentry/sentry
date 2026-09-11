import {Fragment} from 'react';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {EventTags} from 'sentry/components/events/eventTags';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';

/**
 * The tag row menu writes project highlight tags and builds its links from the host
 * page's `location.query`; an embed must reach neither. Hoisted so the reference stays
 * stable -- `EventTagsTree` memoizes its columns against it.
 */
const READ_ONLY_ROW_CONFIG = {disableActions: true} as const;

interface EventTagsViewProps {
  /** Link to the issue's tag distributions page. Derived once by the block. */
  distributionsHref: string;
  event: Event;
  /** From `event.projectSlug`; undefined when the events API omitted it. */
  projectSlug: string | undefined;
}

/**
 * Fallback for events served without a project slug -- `EventTags` needs one to
 * load the detailed project it renders tag rows against, so show the raw pairs
 * rather than an empty section.
 */
function PlainTagList({event}: {event: Event}) {
  const tags = event.tags ?? [];

  if (tags.length === 0) {
    return <Text variant="muted">{t('This event has no tags.')}</Text>;
  }

  return (
    <Grid columns={{zero: 'minmax(0, 1fr)', sm: 'max-content minmax(0, 1fr)'}} gap="xs">
      {tags.map(tag => (
        <Fragment key={tag.key}>
          <Text bold ellipsis size="sm">
            {tag.key}
          </Text>
          <Text ellipsis size="sm" variant="muted">
            {tag.value ?? ''}
          </Text>
        </Fragment>
      ))}
    </Grid>
  );
}

export function EventTagsView({
  event,
  projectSlug,
  distributionsHref,
}: EventTagsViewProps) {
  return (
    <Stack gap="md">
      <Flex align="center" gap="md" justify="between" wrap="wrap">
        <Text bold size="xs" uppercase variant="muted">
          {t('Tags')}
        </Text>
        <ResourceLink
          icon={IconIssues}
          href={distributionsHref}
          title={t('All tags for this issue')}
        />
      </Flex>
      {projectSlug ? (
        <EventTags
          event={event}
          projectSlug={projectSlug}
          config={READ_ONLY_ROW_CONFIG}
        />
      ) : (
        <PlainTagList event={event} />
      )}
    </Stack>
  );
}
