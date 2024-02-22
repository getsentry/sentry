import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {EventTag} from 'sentry/types';

interface TagTree {
  [key: string]: TagTreeContent;
}
interface TagTreeContent {
  subtree: TagTree;
  value: string;
}

function addToTagTree(tree: TagTree, {key, value}: EventTag): TagTree {
  const splitIndex = key.indexOf('.');
  // No need to split this key
  if (splitIndex === -1) {
    tree[key] = {value, subtree: {}};
    return tree;
  }
  // E.g. 'device.model.version'
  const trunk = key.slice(0, splitIndex); // 'device'
  const branch = key.slice(splitIndex + 1); // 'model.version'

  if (tree[trunk] === undefined) {
    // We need to define the default as an empty space for alignment, with `white-space: pre-wrap`
    tree[trunk] = {value: ' ', subtree: {}};
  }
  tree[trunk].subtree = addToTagTree(tree[trunk].subtree, {key: branch, value});
  return tree;
}

interface TagsTreeProps {
  content: TagTreeContent;
  tag: string;
}

function TagTreeKeys({content, tag}: TagsTreeProps) {
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

function TagTreeValues({content, tag}: TagsTreeProps) {
  const subtreeTags = Object.keys(content.subtree);
  return (
    <TreeValueTrunk>
      <TreeValue>{content.value}</TreeValue>
      {subtreeTags.map((t, i) => (
        <TagTreeValues key={`${tag}-${i}-value`} tag={t} content={content.subtree[t]} />
      ))}
    </TreeValueTrunk>
  );
}

interface EventTagsTreeProps {
  tags: EventTag[];
}

function EventTagsTree({tags}: EventTagsTreeProps) {
  const tagTree = tags.reduce<TagTree>((tree, tag) => addToTagTree(tree, tag), {});

  return (
    <TreeContainer>
      <TreeGarden>
        {Object.keys(tagTree).map((tag, i) => (
          <TreeItem key={`${tag}_${i}`}>
            <TagTreeKeys tag={tag} content={tagTree[tag]} />
            <TagTreeValues tag={tag} content={tagTree[tag]} />
          </TreeItem>
        ))}
      </TreeGarden>
    </TreeContainer>
  );
}

const TreeContainer = styled('div')`
  column-count: 2;
  column-rule: 1px solid ${p => p.theme.gray100};
  column-gap: 15%;
`;

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
