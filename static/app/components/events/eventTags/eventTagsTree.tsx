import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {
  type EventTagTreeRowConfig,
  EventTagsTreeRow,
} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {
  TreeColumn as KeyValueTreeColumn,
  TreeContainer,
} from 'sentry/components/keyValueTree/styles';
import {
  buildKeyValueTree,
  getKeyValueTreeColumns,
  type KeyValueTreeContent,
} from 'sentry/components/keyValueTree/utils';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
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
  config?: EventTagTreeRowConfig;
}

/**
 * Component to render proportional columns for event tags. The columns will not separate
 * branch tags from their roots, and attempt to be as evenly distributed as possible.
 */
function TagTreeColumns({
  tags,
  columnCount,
  projectSlug,
  event,
  config,
}: EventTagsTreeProps & {columnCount: number}) {
  const organization = useOrganization();
  const {data: project, isPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug,
  });
  const assembledColumns = useMemo(() => {
    if (isPending) {
      return <TreeLoadingIndicator />;
    }

    if (!project) {
      return [];
    }

    const tagTree = buildKeyValueTree(
      tags.map(tag => ({
        key: tag.key,
        value: tag.value,
        meta: tag.meta,
        original: tag,
      }))
    );

    return getKeyValueTreeColumns(tagTree, columnCount).map((rows, index) => (
      <TreeColumn key={index} data-test-id="tag-tree-column">
        {rows.map(row => (
          <EventTagsTreeRow
            key={row.uniqueKey}
            tagKey={row.treeKey}
            content={row.content}
            spacerCount={row.spacerCount}
            isLast={row.isLast}
            data-test-id="tag-tree-row"
            event={event}
            project={project}
            config={config}
          />
        ))}
      </TreeColumn>
    ));
  }, [columnCount, isPending, project, event, tags, config]);

  return <Fragment>{assembledColumns}</Fragment>;
}

export function EventTagsTree(props: EventTagsTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);
  return (
    <ErrorBoundary mini message={t('There was a problem loading event tags.')}>
      <TreeContainer
        columnCount={columnCount}
        ref={containerRef}
        data-test-id="event-tags-tree"
      >
        <TagTreeColumns columnCount={columnCount} {...props} />
      </TreeContainer>
    </ErrorBoundary>
  );
}

export const TreeColumn = styled(KeyValueTreeColumn)`
  grid-template-columns: minmax(auto, 175px) 1fr;
  &:first-child {
    margin-left: -${p => p.theme.space.md};
  }
`;

const TreeLoadingIndicator = styled(LoadingIndicator)`
  grid-column: 1 /-1;
`;
