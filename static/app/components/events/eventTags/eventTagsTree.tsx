import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import EventTagsContent from 'sentry/components/events/eventTags/eventTagContent';
import type {TagFilter} from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {space} from 'sentry/styles/space';
import type {EventTag} from 'sentry/types';
import {generateQueryWithTag} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const MAX_TREE_DEPTH = 4;
const INVALID_BRANCH_REGEX = /\.{2,}/;
const COLUMN_COUNT = 2;

interface TagTree {
  [key: string]: TagTreeContent;
}

interface TagTreeContent {
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

interface TagTreeRowProps {
  content: TagTreeContent;
  projectId: string;
  projectSlug: string;
  streamPath: string;
  tagKey: string;
  isEven?: boolean;
  isLast?: boolean;
  spacerCount?: number;
}

interface EventTagsTreeProps {
  projectId: string;
  projectSlug: string;
  streamPath: string;
  tagFilter: TagFilter;
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

function TagTreeRow({
  content,
  tagKey,
  spacerCount = 0,
  isLast = false,
  ...props
}: TagTreeRowProps) {
  const organization = useOrganization();
  const location = useLocation();
  const originalTag = content.originalTag;

  return (
    <TreeRow>
      <TreeKeyTrunk spacerCount={spacerCount}>
        {spacerCount > 0 && (
          <Fragment>
            <TreeSpacer spacerCount={spacerCount} isLast={isLast} />
            <TreeBranchIcon />
          </Fragment>
        )}
        <TreeKey>{tagKey}</TreeKey>
      </TreeKeyTrunk>
      <TreeValueTrunk>
        <TreeValue>
          {originalTag ? (
            <EventTagsContent
              tag={originalTag}
              organization={organization}
              query={generateQueryWithTag(
                {...location.query, referrer: 'event-tags-tree'},
                originalTag
              )}
              meta={content?.meta ?? {}}
              {...props}
            />
          ) : (
            content.value
          )}
        </TreeValue>
      </TreeValueTrunk>
    </TreeRow>
  );
}

/**
 * Function to recursively create a flat list of all rows to be rendered for a given TagTree
 * @param props The props for rendering the root of the TagTree
 * @returns A list of TagTreeRow components to be rendered in this tree
 */
function getTagTreeRows({tagKey, content, spacerCount = 0, ...props}: TagTreeRowProps) {
  const subtreeTags = Object.keys(content.subtree);
  const subtreeRows = subtreeTags.reduce((rows, t, i) => {
    const branchRows = getTagTreeRows({
      ...props,
      tagKey: t,
      content: content.subtree[t],
      spacerCount: spacerCount + 1,
      isLast: i === subtreeTags.length - 1,
    });
    return rows.concat(branchRows);
  }, []);

  return [
    <TagTreeRow
      key={`${tagKey}-${spacerCount}`}
      tagKey={tagKey}
      content={content}
      spacerCount={spacerCount}
      {...props}
    />,
    ...subtreeRows,
  ];
}

/**
 * Component to render proportional columns for event tags. The columns will not separate
 * branch tags from their roots, and attempt to be as evenly distributed as possible.
 */
function TagTreeColumns({meta, tags, ...props}: EventTagsTreeProps) {
  const assembledColumns = useMemo(() => {
    // Create the TagTree data structure using all the given tags
    const tagTree = tags.reduce<TagTree>(
      (tree, tag, i) => addToTagTree(tree, tag, meta?.[i], tag),
      {}
    );
    // Create a list of TagTreeRow lists, containing every row to be rendered. They are grouped by
    // root parent so that we do not split up roots/branches when forming columns
    const tagTreeRowGroups: React.ReactNode[][] = Object.entries(tagTree).map(
      ([tagKey, content]) => getTagTreeRows({tagKey, content, ...props})
    );
    // Get the total number of TagTreeRow components to be rendered, and a goal size for each column
    const tagTreeRowTotal = tagTreeRowGroups.reduce(
      (sum, group) => sum + group.length,
      0
    );
    const columnRowGoal = tagTreeRowTotal / COLUMN_COUNT;

    // Iterate through the row groups, splitting rows into columns when we exceed the goal size
    const data = tagTreeRowGroups.reduce<TagTreeColumnData>(
      ({startIndex, runningTotal, columns}, rowList, index) => {
        runningTotal += rowList.length;
        // When we reach the goal size wrap rows in a TreeColumn.
        if (runningTotal > columnRowGoal) {
          columns.push(
            <TreeColumn key={columns.length}>
              {tagTreeRowGroups.slice(startIndex, index)}
            </TreeColumn>
          );
          runningTotal = 0;
          startIndex = index;
        }
        // If it's the last entry, wrap the column
        if (index === tagTreeRowGroups.length - 1) {
          columns.push(
            <TreeColumn key={columns.length}>
              {tagTreeRowGroups.slice(startIndex)}
            </TreeColumn>
          );
        }
        return {startIndex, runningTotal, columns};
      },
      {startIndex: 0, runningTotal: 0, columns: []}
    );

    return data.columns;
  }, [meta, tags, props]);

  return <Fragment>{assembledColumns}</Fragment>;
}

function EventTagsTree(props: EventTagsTreeProps) {
  return (
    <TreeContainer>
      <TreeGarden columnCount={COLUMN_COUNT}>
        <TagTreeColumns {...props} />
      </TreeGarden>
    </TreeContainer>
  );
}

const TreeContainer = styled('div')`
  margin-top: ${space(1.5)};
`;

const TreeGarden = styled('div')<{columnCount: number}>`
  display: grid;
  gap: 0 ${space(2)};
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  align-items: start;
`;

const TreeColumn = styled('div')`
  display: grid;
  grid-template-columns: minmax(auto, 150px) 1fr;
  grid-column-gap: ${space(3)};
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.gray200};
    padding-left: ${space(2)};
  }
`;

const TreeRow = styled('div')`
  border-radius: ${space(0.5)};
  padding: 0 ${space(1)};
  display: grid;
  grid-column: span 2;
  grid-template-columns: subgrid;
  :nth-child(odd) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const TreeSpacer = styled('div')<{isLast: boolean; spacerCount: number}>`
  grid-column: span 1;
  /* Allows TreeBranchIcons to appear connected vertically */
  border-right: 1px solid ${p => (!p.isLast ? p.theme.gray200 : 'transparent')};
  margin-right: -1px;
`;

const TreeBranchIcon = styled('div')`
  border: 1px solid ${p => p.theme.gray200};
  border-width: 0 0 1px 1px;
  border-radius: 0 0 0 5px;
  grid-column: span 1;
  margin: 0 ${space(0.5)} 0.5rem 0;
`;

const TreeKeyTrunk = styled('div')<{spacerCount: number}>`
  grid-column: 1 / 2;
  display: grid;
  grid-template-columns: ${p =>
    p.spacerCount > 0 ? `${(p.spacerCount - 1) * 20 + 3}px 1rem 1fr` : '1fr'};
`;

const TreeValueTrunk = styled('div')`
  grid-column: 2 / 3;
`;

const TreeValue = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  word-break: break-word;
`;

const TreeKey = styled(TreeValue)`
  grid-column: span 1;
  color: ${p => p.theme.gray300};
`;

export default EventTagsTree;
