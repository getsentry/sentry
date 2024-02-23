import styled from '@emotion/styled';

import EventTagsContent from 'sentry/components/events/eventTags/eventTagContent';
import {space} from 'sentry/styles/space';
import type {EventTag} from 'sentry/types';
import {generateQueryWithTag} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const MAX_TREE_DEPTH = 4;
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
  const branchMatches = tag.key.match(/\./g) ?? [];

  const hasInvalidBranchCount =
    branchMatches.length <= 0 || branchMatches.length > MAX_TREE_DEPTH;
  const hasInvalidBranchSequence = /\.{2,}/g.test(tag.key);

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
    // We need to define the default as an empty space for alignment
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

function EventTagsTree({tags, meta, ...props}: EventTagsTreeProps) {
  const tagTree = tags.reduce<TagTree>(
    (tree, tag, i) => addToTagTree(tree, tag, meta?.[i], tag),
    {}
  );
  return (
    <TreeContainer>
      <TreeGarden>
        {Object.keys(tagTree).map((tagKey, i) => (
          <TreeItem key={`${tagKey}_${i}`}>
            <TagTreeKeys tag={tagKey} content={tagTree[tagKey]} />
            <TagTreeValues tag={tagKey} content={tagTree[tagKey]} {...props} />
          </TreeItem>
        ))}
      </TreeGarden>
    </TreeContainer>
  );
}

const TreeContainer = styled('div')``;

const TreeGarden = styled('div')`
  display: grid;
  gap: ${space(1)} ${space(2)};
  grid-template-columns: 1fr 1fr;
  width: 200px;
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
  padding: ${space(0.5)} ${space(1)};
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
  grid-column: 1 / 2;
  line-height: 1;
  white-space: pre;
  overflow-x: scroll;
`;

const TreeKey = styled(TreeValue)`
  color: ${p => p.theme.gray300};
`;

export default EventTagsTree;
