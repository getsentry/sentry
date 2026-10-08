import {useMemo} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventTagsTreeRow} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {
  buildKeyValueTree,
  getKeyValueTreeColumns,
  type KeyValueTreeContent,
  type KeyValueTreeRowConfig,
} from 'sentry/components/keyValueTree/utils';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {KeyValueColumns} from 'sentry/components/tables/keyValueTable';
import {t} from 'sentry/locale';
import type {Event, EventTagWithMeta} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useOrganization} from 'sentry/utils/useOrganization';

export type TagTreeContent = KeyValueTreeContent<string, EventTagWithMeta>;

interface EventTagsTreeProps {
  event: Event;
  projectSlug: Project['slug'];
  tags: EventTagWithMeta[];
  /** Applied to every row; e.g. `disableActions` for read-only surfaces. */
  config?: KeyValueTreeRowConfig;
}

export function EventTagsTree({tags, projectSlug, event, config}: EventTagsTreeProps) {
  const organization = useOrganization();
  const {data: project, isPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug,
  });
  const tagTree = useMemo(
    () =>
      buildKeyValueTree(
        tags.map(tag => ({
          key: tag.key,
          value: tag.value,
          meta: tag.meta,
          original: tag,
        }))
      ),
    [tags]
  );

  return (
    <ErrorBoundary mini message={t('There was a problem loading event tags.')}>
      {isPending ? (
        <LoadingIndicator />
      ) : project ? (
        <KeyValueColumns data-test-id="event-tags-tree" columnTestId="tag-tree-column">
          {columnCount =>
            getKeyValueTreeColumns(tagTree, columnCount).map(rows =>
              rows.map(row => (
                <EventTagsTreeRow
                  key={row.uniqueKey}
                  tagKey={row.treeKey}
                  content={row.content}
                  spacerCount={row.spacerCount}
                  hasStem={row.hasStem}
                  data-test-id="tag-tree-row"
                  event={event}
                  project={project}
                  config={config}
                />
              ))
            )
          }
        </KeyValueColumns>
      ) : null}
    </ErrorBoundary>
  );
}
