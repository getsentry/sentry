import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';

type DirContent = Record<string, unknown>;

interface Props extends ComponentProps<'div'> {
  files: string[];
}

export default function StoryList({files, style}: Props) {
  const tree = toTree(files);

  return (
    <div style={style}>
      <FolderContent path="" content={tree} />
    </div>
  );
}

function FolderContent({path, content}: {content: DirContent; path: string}) {
  return (
    <UnorderedList>
      {Object.entries(content).map(([name, children]) => {
        const childContent = children as DirContent;

        if (Object.keys(childContent).length === 0) {
          return (
            <FolderName key={name}>
              <Link to={`/stories/?name=${toPath(path, name)}`}>{name}</Link>
            </FolderName>
          );
        }
        return (
          <ListItem key={name}>
            <Folder open>
              <FolderName>{name}</FolderName>
              <FolderContent path={toPath(path, name)} content={childContent} />
            </Folder>
          </ListItem>
        );
      })}
    </UnorderedList>
  );
}

function toTree(files: string[]) {
  const root = {};
  for (const file of files) {
    const parts = file.split('/');
    let tree = root;
    for (const part of parts) {
      if (!(part in tree)) {
        tree[part] = {};
      }
      tree = tree[part];
    }
  }
  return root;
}

function toPath(path: string, name: string) {
  return [path, name].filter(Boolean).join('/');
}

const UnorderedList = styled('ul')`
  margin: 0;
  padding: 0 0 0 ${space(1)};
  list-style: none;
`;
const ListItem = styled('li')``;

const Folder = styled('details')`
  position: relative;
  cursor: pointer;

  &:before {
    content: '⏵';
    position: absolute;
    left: 0;
    top: 0;
  }
  &[open]:before {
    content: '⏷';
  }
`;

const FolderName = styled('summary')`
  padding-left: ${space(1.5)};
`;
