import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventTagsTreeRow, {
  type EventTagsTreeRowProps,
} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventTag} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

const MAX_TREE_DEPTH = 4;
const INVALID_BRANCH_REGEX = /\.{2,}/;

interface TagTree {
  [key: string]: TagTreeContent;
}

export interface TagTreeContent {
  subtree: TagTree;
  value: string;
  // These will be omitted on pseudo tags (see addToTagTree)
  meta?: Record<any, any>;
  originalTag?: EventTag;
}

interface TagTreeColumnData {
  columns: React.ReactNode[];
  runningTotal: number;
  startIndex: number;
}

interface EventTagsTreeProps {
  event: Event;
  projectSlug: Project['slug'];
  tags: EventTag[];
  meta?: Record<any, any>;
}

function addToTagTree(
  tree: TagTree,
  tag: EventTag,
  meta: Record<any, any>,
  originalTag: EventTag
): TagTree {
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
    tree[tag.key] = {value: tag.value, subtree: {}, meta, originalTag};
    return tree;
  }
  // E.g. 'device.model.version'
  const splitIndex = tag.key.indexOf('.'); // 6
  const trunk = tag.key.slice(0, splitIndex); // 'device'
  const branch = tag.key.slice(splitIndex + 1); // 'model.version'

  if (tree[trunk] === undefined) {
    tree[trunk] = {value: '', subtree: {}};
  }
  // Recurse with a pseudo tag, e.g. 'model', to create nesting structure
  const pseudoTag = {
    key: branch,
    value: tag.value,
  };
  tree[trunk].subtree = addToTagTree(tree[trunk].subtree, pseudoTag, meta, originalTag);
  return tree;
}

/**
 * Function to recursively create a flat list of all rows to be rendered for a given TagTree
 * @param props The props for rendering the root of the TagTree
 * @returns A list of TagTreeRow components to be rendered in this tree
 */
// @ts-ignore TS(7023): 'getTagTreeRows' implicitly has return type 'any' ... Remove this comment to see the full error message
function getTagTreeRows({
  tagKey,
  content,
  spacerCount = 0,
  uniqueKey,
  ...props
}: EventTagsTreeRowProps & {uniqueKey: string}) {
  const subtreeTags = Object.keys(content.subtree);
  // @ts-ignore TS(7022): 'subtreeRows' implicitly has type 'any' because it... Remove this comment to see the full error message
  const subtreeRows = subtreeTags.reduce((rows, tag, i) => {
    // @ts-ignore TS(7022): 'branchRows' implicitly has type 'any' because it ... Remove this comment to see the full error message
    const branchRows = getTagTreeRows({
      ...props,
      tagKey: tag,
      content: content.subtree[tag]!,
      spacerCount: spacerCount + 1,
      isLast: i === subtreeTags.length - 1,
      // Encoding the trunk index with the branch index ensures uniqueness for the key
      uniqueKey: `${uniqueKey}-${i}`,
    });
    return rows.concat(branchRows);
  }, []);
  return [
    <EventTagsTreeRow
      key={`${tagKey}-${spacerCount}-${uniqueKey}`}
      tagKey={tagKey}
      content={content}
      spacerCount={spacerCount}
      data-test-id="tag-tree-row"
      {...props}
    />,
    ...subtreeRows,
  ];
}

/**
 * Component to render proportional columns for event tags. The columns will not separate
 * branch tags from their roots, and attempt to be as evenly distributed as possible.
 */
function TagTreeColumns({
  meta,
  tags,
  columnCount,
  projectSlug,
  ...props
}: EventTagsTreeProps & {columnCount: number}) {
  const organization = useOrganization();
  const {data: project, isPending} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug,
  });
  const assembledColumns = useMemo(() => {
    if (isPending) {
      return <TreeLoadingIndicator hideMessage />;
    }

    if (!project) {
      return [];
    }
    // Create the TagTree data structure using all the given tags
    const tagTree = tags.reduce<TagTree>(
      (tree, tag, i) => addToTagTree(tree, tag, meta?.[i], tag),
      {}
    );
    // Create a list of TagTreeRow lists, containing every row to be rendered. They are grouped by
    // root parent so that we do not split up roots/branches when forming columns
    const tagTreeRowGroups: React.ReactNode[][] = Object.entries(tagTree).map(
      ([tagKey, content], i) =>
        getTagTreeRows({tagKey, content, uniqueKey: `${i}`, project, ...props})
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
  }, [columnCount, isPending, project, props, tags, meta]);

  return <Fragment>{assembledColumns}</Fragment>;
}

function EventTagsTree(props: EventTagsTreeProps) {
  const hasStreamlinedUI = useHasStreamlinedUI();
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);
  return (
    <ErrorBoundary mini message={t('There was a problem loading event tags.')}>
      <TreeContainer
        columnCount={columnCount}
        ref={containerRef}
        data-test-id="event-tags-tree"
        style={hasStreamlinedUI ? {marginTop: 0} : undefined}
      >
        <TagTreeColumns columnCount={columnCount} {...props} />
      </TreeContainer>
    </ErrorBoundary>
  );
}

export const TreeContainer = styled('div')<{columnCount: number}>`
  margin-top: ${space(1.5)};
  display: grid;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  align-items: start;
`;

export const TreeColumn = styled('div')`
  display: grid;
  grid-template-columns: minmax(auto, 175px) 1fr;
  grid-column-gap: ${space(3)};
  &:first-child {
    margin-left: -${space(1)};
  }
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.innerBorder};
    padding-left: ${space(2)};
    margin-left: -1px;
  }
  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.innerBorder};
    padding-right: ${space(2)};
  }
`;

export const TreeLoadingIndicator = styled(LoadingIndicator)`
  grid-column: 1 /-1;
`;

export default EventTagsTree;
