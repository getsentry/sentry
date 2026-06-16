import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {
  EventTagsTreeRow,
  type EventTagsTreeRowProps,
} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Event, EventTagWithMeta} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useOrganization} from 'sentry/utils/useOrganization';

const MAX_TREE_DEPTH = 4;
const INVALID_BRANCH_REGEX = /\.{2,}/;

type TagTree = Map<string, TagTreeContent>;

export interface TagTreeContent {
  subtree: TagTree;
  value: string;
  // These will be omitted on pseudo tags (see addToTagTree)
  meta?: Record<string, any>;
  originalTag?: EventTagWithMeta;
}

interface TagTreeColumnData {
  columns: React.ReactNode[];
  runningTotal: number;
  startIndex: number;
}

interface EventTagsTreeProps {
  event: Event;
  projectSlug: Project['slug'];
  tags: EventTagWithMeta[];
}

function addToTagTree({
  tree,
  tag,
  originalTag,
}: {
  originalTag: EventTagWithMeta;
  tag: EventTagWithMeta;
  tree: TagTree;
}): TagTree {
  const BRANCH_MATCHES_REGEX = /\./g;
  if (!defined(tag.key)) {
    return tree;
  }

  const branchMatches = tag.key.match(BRANCH_MATCHES_REGEX) ?? [];

  const hasInvalidBranchCount =
    branchMatches.length <= 0 || branchMatches.length > MAX_TREE_DEPTH;
  const hasInvalidBranchSequence = INVALID_BRANCH_REGEX.test(tag.key);

  // Ignore tags with 0, or >4 branches, as well as sequential dots (e.g. 'some..tag')
  if (hasInvalidBranchCount || hasInvalidBranchSequence) {
    tree.set(tag.key, {
      value: tag.value,
      subtree: new Map<string, TagTreeContent>(),
      meta: originalTag?.meta,
      originalTag,
    });
    return tree;
  }
  // E.g. 'device.model.version'
  const splitIndex = tag.key.indexOf('.'); // 6
  const trunk = tag.key.slice(0, splitIndex); // 'device'
  const branch = tag.key.slice(splitIndex + 1); // 'model.version'

  let trunkNode = tree.get(trunk);
  if (!trunkNode) {
    trunkNode = {value: '', subtree: new Map<string, TagTreeContent>()};
    tree.set(trunk, trunkNode);
  }
  // Recurse with a pseudo tag, e.g. 'model', to create nesting structure
  const pseudoTag = {
    key: branch,
    value: tag.value,
  };
  trunkNode.subtree = addToTagTree({
    tree: trunkNode.subtree,
    tag: pseudoTag,
    originalTag,
  });
  return tree;
}

/**
 * Function to recursively create a flat list of all rows to be rendered for a given TagTree
 * @param props The props for rendering the root of the TagTree
 * @returns A list of TagTreeRow components to be rendered in this tree
 */
function getTagTreeRows({
  tagKey,
  content,
  spacerCount = 0,
  uniqueKey,
  event,
  project,
  isLast,
}: EventTagsTreeRowProps & {uniqueKey: string}): React.ReactNode[] {
  const subtreeEntries = Array.from(content.subtree.entries());
  const subtreeRows = subtreeEntries.reduce<React.ReactNode[]>(
    (rows, [tag, tagContent], i) => {
      const branchRows = getTagTreeRows({
        event,
        project,
        tagKey: tag,
        content: tagContent,
        spacerCount: spacerCount + 1,
        isLast: i === subtreeEntries.length - 1,
        // Encoding the trunk index with the branch index ensures uniqueness for the key
        uniqueKey: `${uniqueKey}-${i}`,
      });
      return rows.concat(branchRows);
    },
    []
  );
  return [
    <EventTagsTreeRow
      key={`${tagKey}-${spacerCount}-${uniqueKey}`}
      tagKey={tagKey}
      content={content}
      spacerCount={spacerCount}
      data-test-id="tag-tree-row"
      event={event}
      project={project}
      isLast={isLast}
    />,
    ...subtreeRows,
  ];
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
    // Create the TagTree data structure using all the given tags
    const tagTree = tags.reduce(
      (tree, tag) => addToTagTree({tree, tag, originalTag: tag}),
      new Map<string, TagTreeContent>()
    );
    // Create a list of TagTreeRow lists, containing every row to be rendered. They are grouped by
    // root parent so that we do not split up roots/branches when forming columns
    const tagTreeRowGroups: React.ReactNode[][] = Array.from(tagTree.entries()).map(
      ([tagKey, content], i) =>
        getTagTreeRows({tagKey, content, uniqueKey: `${i}`, project, event})
    );
    // Get the total number of TagTreeRow components to be rendered, and a goal size for each column
    const tagTreeRowTotal = tagTreeRowGroups.reduce(
      (sum, group) => sum + group.length,
      0
    );
    const columnRowGoal = Math.ceil(tagTreeRowTotal / columnCount);

    // Iterate through the row groups, splitting rows into columns when we exceed the goal size
    const data = tagTreeRowGroups.reduce<TagTreeColumnData>(
      ({startIndex, runningTotal, columns}, rowList, index) => {
        // If it's the last entry, create a column with the remaining rows
        if (index === tagTreeRowGroups.length - 1) {
          columns.push(
            <TreeColumn key={columns.length} data-test-id="tag-tree-column">
              {tagTreeRowGroups.slice(startIndex)}
            </TreeColumn>
          );
          return {startIndex, runningTotal, columns};
        }
        // If we reach the goal column size, wrap rows in a TreeColumn.
        if (runningTotal >= columnRowGoal) {
          columns.push(
            <TreeColumn key={columns.length} data-test-id="tag-tree-column">
              {tagTreeRowGroups.slice(startIndex, index)}
            </TreeColumn>
          );
          runningTotal = 0;
          startIndex = index;
        }
        runningTotal += rowList.length;
        return {startIndex, runningTotal, columns};
      },
      {startIndex: 0, runningTotal: 0, columns: []}
    );
    return data.columns;
  }, [columnCount, isPending, project, event, tags]);

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

export const TreeContainer = styled('div')<{columnCount: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  align-items: start;
`;

export const TreeColumn = styled('div')`
  display: grid;
  grid-template-columns: minmax(auto, 175px) 1fr;
  grid-column-gap: ${p => p.theme.space['2xl']};
  &:first-child {
    margin-left: -${p => p.theme.space.md};
  }
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-left: ${p => p.theme.space.xl};
    margin-left: -1px;
  }
  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.tokens.border.secondary};
    padding-right: ${p => p.theme.space.xl};
  }
`;

const TreeLoadingIndicator = styled(LoadingIndicator)`
  grid-column: 1 /-1;
`;
