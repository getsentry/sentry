import {useMemo} from 'react';
import styled from '@emotion/styled';

import EventTagsContent from 'sentry/components/events/eventTags/eventTagContent';
import {space} from 'sentry/styles/space';
import type {EventTag} from 'sentry/types';
import {generateQueryWithTag} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const MAX_TREE_DEPTH = 4;
const INVALID_BRANCH_REGEX = /\.{2,}/;

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
    tree[trunk] = {value: ' ', subtree: {}};
  }
  // Recurse with a pseudo tag, e.g. 'model', to create nesting structure
  const pseudoTag = {
    key: branch,
    value: tag.value,
  };
  tree[trunk].subtree = addToTagTree(tree[trunk].subtree, pseudoTag, meta, originalTag);
  return tree;
}

interface TagsTreeKeysProps {
  content: TagTreeContent;
  tag: string;
}

function TagTreeKeys({content, tag}: TagsTreeKeysProps) {
  const subtreeTags = Object.keys(content.subtree);
  return (
    <TreeKeyTrunk>
      <TreeKey>{tag}</TreeKey>
      {subtreeTags.map((t, i) => (
        <TreeSubtreeWrapper key={`${tag}-${i}-key`} isLast={i === subtreeTags.length - 1}>
          <TreeSpacer />
          <TagTreeKeys tag={t} content={content.subtree[t]} />
        </TreeSubtreeWrapper>
      ))}
    </TreeKeyTrunk>
  );
}
interface TagsTreeValuesProps extends TagsTreeKeysProps {
  projectId: string;
  projectSlug: string;
  streamPath: string;
}

function TagTreeValues({content, tag, ...props}: TagsTreeValuesProps) {
  const subtreeTags = Object.keys(content.subtree);
  const organization = useOrganization();
  const location = useLocation();
  const originalTag = content.originalTag;
  return (
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
      {subtreeTags.map((t, i) => (
        <TagTreeValues
          key={`${tag}-${i}-value`}
          tag={t}
          content={content.subtree[t]}
          {...props}
        />
      ))}
    </TreeValueTrunk>
  );
}

interface EventTagsTreeProps {
  projectId: string;
  projectSlug: string;
  streamPath: string;
  tags: EventTag[];
  meta?: Record<any, any>;
}

function createTagTreeItemData(
  tags: EventTagsTreeProps['tags'],
  meta: EventTagsTreeProps['meta']
): [string, TagTreeContent][] {
  const tagTree = tags.reduce<TagTree>(
    (tree, tag, i) => addToTagTree(tree, tag, meta?.[i], tag),
    {}
  );
  return Object.entries(tagTree);
}

function EventTagsTree({tags, meta, ...props}: EventTagsTreeProps) {
  const tagTreeItemData = useMemo(() => createTagTreeItemData(tags, meta), [tags, meta]);
  return (
    <TreeContainer>
      <TreeGarden>
        {tagTreeItemData.map(([tagKey, tagTreeContent]) => (
          <TreeItem key={tagKey}>
            <TagTreeKeys tag={tagKey} content={tagTreeContent} />
            <TagTreeValues tag={tagKey} content={tagTreeContent} {...props} />
          </TreeItem>
        ))}
      </TreeGarden>
    </TreeContainer>
  );
}

const TreeContainer = styled('div')``;

const TreeGarden = styled('div')`
  display: grid;
  gap: 0 ${space(2)};
  grid-template-columns: 1fr 1fr;
`;

const TreeItem = styled('div')`
  display: grid;
  grid-column: span 2;
  grid-template-columns: subgrid;
  background-color: ${p => p.theme.background};
  :nth-child(odd) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)} ${space(1)};
`;

const TreeKeyTrunk = styled('div')`
  grid-column: 1 / 2;
`;

const TreeValueTrunk = styled('div')`
  grid-column: 2 / 3;
`;

const TreeSubtreeWrapper = styled('div')<{isLast: boolean}>`
  display: flex;
  margin-left: ${space(0.25)};
  border-left: 1px solid ${p => (!p.isLast ? p.theme.gray200 : 'transparent')};
  box-sizing: content-box;
  align-items: start;
`;

const TreeSpacer = styled('div')`
  flex: 0;
  border: 1px solid ${p => p.theme.gray200};
  border-width: 0 0 1px 1px;
  border-radius: 0 0 0 5px;
  padding: ${space(0.75)};
  margin: -${space(0.25)} ${space(0.5)} ${space(0.75)} -1px;
`;

const TreeValue = styled('span')`
  font-family: ${p => p.theme.text.familyMono};

  white-space: pre;
  display: inline-block;
`;

const TreeKey = styled(TreeValue)`
  color: ${p => p.theme.gray300};
`;

export default EventTagsTree;
