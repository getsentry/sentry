import type {ComponentProps} from 'react';
import {useMemo} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {IconFile} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import type {StoriesQuery} from 'sentry/views/stories/types';

interface Props extends ComponentProps<'div'> {
  files: string[];
}

export default function StoryTree({files, style}: Props) {
  const tree = useMemo(() => {
    const fileTree = new StoryTreeModel();

    for (const file of files) {
      const parts = file.split('/');
      let parent = fileTree.root;

      for (const part of parts) {
        if (!(part in parent.children)) {
          parent.children[part] = new StoryTreeNode(part);
        }

        parent = parent.children[part]!;
      }
    }

    return tree;
  }, [files]);

  return (
    <nav style={style}>
      <FolderContent path="" content={tree} />
    </nav>
  );
}

function FolderContent({path, content}: {content: Tree; path: string}) {
  const location = useLocation<StoriesQuery>();
  const currentFile = location.query.name;

  // sort folders to the top
  const entries = Object.entries(content).sort(
    (a, b) => Number(!!Object.keys(b[1]).length) - Number(!!Object.keys(a[1]).length)
  );

  return (
    <UnorderedList>
      {entries.map(([name, children]) => {
        const childPath = toPath(path, name);

        if (Object.keys(children).length === 0) {
          const isCurrent = childPath === currentFile ? true : undefined;
          const to = `/stories/?name=${childPath}`;
          return (
            <ListItem key={name} aria-current={isCurrent}>
              <FolderLink to={to}>
                <IconFile size="xs" />
                {name}
              </FolderLink>
            </ListItem>
          );
        }

        return (
          <ListItem key={name}>
            <Folder open>
              <FolderName>{name}</FolderName>
              <FolderContent path={childPath} content={children} />
            </Folder>
          </ListItem>
        );
      })}
    </UnorderedList>
  );
}

class StoryTreeNode {
  expanded = false;
  children: Record<string, StoryTreeNode> = {};

  constructor(public name: string) {}
}
class StoryTreeModel {
  constructor() {
    this.root = new StoryTreeNode('');
  }

  root: StoryTreeNode;
}

function toPath(path: string, name: string) {
  return [path, name].filter(Boolean).join('/');
}

const UnorderedList = styled('ul')`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const ListItem = styled('li')`
  position: relative;

  &[aria-current] {
    background: ${p => p.theme.blue300};
    color: ${p => p.theme.white};
    font-weight: ${p => p.theme.fontWeightBold};
  }
  &[aria-current] a:before {
    background: ${p => p.theme.blue300};
    content: '';
    left: -100%;
    position: absolute;
    right: 0;
    top: 0;
    z-index: -1;
    bottom: 0;
  }
`;

const Folder = styled('details')`
  cursor: pointer;
  padding-left: ${space(2)};
  position: relative;

  &:before {
    content: '⏵';
    position: absolute;
    left: ${space(0.5)};
    top: ${space(0.25)};
  }
  &[open]:before {
    content: '⏷';
  }
`;

const FolderName = styled('summary')`
  padding: ${space(0.25)};

  color: inherit;
  &:hover {
    color: inherit;
  }
  &:hover:before {
    background: ${p => p.theme.blue100};
    content: '';
    left: -100%;
    position: absolute;
    right: 0;
    top: 0;
    z-index: -1;
    bottom: 0;
  }
`;

const FolderLink = styled(Link)`
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: baseline;
  gap: ${space(0.5)};
  padding: ${space(0.25)};
  white-space: nowrap;

  color: inherit;
  &:hover {
    color: inherit;
  }
  &:hover:before {
    background: ${p => p.theme.blue100};
    content: '';
    left: -100%;
    position: absolute;
    right: 0;
    top: 0;
    z-index: -1;
    bottom: 0;
  }
`;
