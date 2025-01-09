import {useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {IconChevron, IconFile} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

import type {StoryTreeNode} from './index';

function folderOrSearchScoreFirst(a: StoryTreeNode, b: StoryTreeNode) {
  if (a.result && b.result) {
    if (a.result.score === b.result.score) {
      return a.name.localeCompare(b.name);
    }
    return b.result.score - a.result.score;
  }

  const aIsFolder = Object.keys(a.children).length > 0;
  const bIsFolder = Object.keys(b.children).length > 0;

  if (aIsFolder && !bIsFolder) {
    return -1;
  }

  if (!aIsFolder && bIsFolder) {
    return 1;
  }

  return a.name.localeCompare(b.name);
}

function normalizeFilename(filename: string) {
  // Do not uppercase the first three characters of the filename
  if (filename.startsWith('use')) {
    return filename.replace('.stories.tsx', '');
  }

  // capitalizes the filename
  return filename.charAt(0).toUpperCase() + filename.slice(1).replace('.stories.tsx', '');
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  nodes: StoryTreeNode[];
}

// @TODO (JonasBadalic): Implement treeview pattern navigation
// https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
export default function StoryTree({nodes, ...htmlProps}: Props) {
  return (
    <nav {...htmlProps}>
      <StoryList>
        {nodes.sort(folderOrSearchScoreFirst).map(node => {
          if (!node.visible) {
            return null;
          }

          return Object.keys(node.children).length === 0 ? (
            <li key={node.name}>
              <File node={node} />
            </li>
          ) : (
            <Folder node={node} key={node.name} />
          );
        })}
      </StoryList>
    </nav>
  );
}

function Folder(props: {node: StoryTreeNode}) {
  const [expanded, setExpanded] = useState(props.node.expanded);

  if (props.node.expanded !== expanded) {
    setExpanded(props.node.expanded);
  }

  if (!props.node.visible) {
    return null;
  }

  return (
    <li>
      <FolderName
        onClick={() => {
          props.node.expanded = !props.node.expanded;
          setExpanded(props.node.expanded);
        }}
      >
        <IconChevron size="xs" direction={expanded ? 'down' : 'right'} />
        {normalizeFilename(props.node.name)}
      </FolderName>
      {expanded && Object.keys(props.node.children).length > 0 && (
        <StoryList>
          {Object.values(props.node.children)
            .sort(folderOrSearchScoreFirst)
            .map(child => {
              if (!child.visible) {
                return null;
              }
              return Object.keys(child.children).length === 0 ? (
                <li>
                  <File key={child.path} node={child} />
                </li>
              ) : (
                <Folder key={child.path} node={child} />
              );
            })}
        </StoryList>
      )}
    </li>
  );
}

function File(props: {node: StoryTreeNode}) {
  const location = useLocation();
  const query = qs.stringify({...location.query, name: props.node.path});

  return (
    <FolderLink
      to={`/stories/?${query}`}
      active={location.query.name === props.node.path}
    >
      {/* @TODO (JonasBadalic): Do file type icons make sense here? */}
      <IconFile size="xs" />
      {/* @TODO (JonasBadalic): Do we need to show the file extension? */}
      {normalizeFilename(props.node.name)}
    </FolderLink>
  );
}

const StoryList = styled('ul')`
  list-style-type: none;
  padding-left: 10px;

  &:first-child {
    padding-left: 0;
  }
`;

const FolderName = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
  padding: ${space(0.25)} 0 ${space(0.25)} ${space(0.5)};
  cursor: pointer;
  position: relative;

  &:before {
    background: ${p => p.theme.surface100};
    content: '';
    inset: 0px 0px 0px -100%;
    position: absolute;
    z-index: -1;
    opacity: 0;
  }

  &:hover {
    &:before {
      opacity: 1;
    }
  }
`;

const FolderLink = styled(Link, {
  shouldForwardProp: prop => prop !== 'active',
})<{active: boolean}>`
  display: flex;
  align-items: center;
  margin-left: ${space(0.5)};
  gap: ${space(0.75)};
  color: ${p => p.theme.textColor};
  padding: ${space(0.25)} 0 ${space(0.25)} ${space(0.5)};
  position: relative;

  &:before {
    background: ${p => p.theme.surface100};
    content: '';
    inset: 0px 0px 0px -100%;
    position: absolute;
    z-index: -1;
    opacity: ${p => (p.active ? 1 : 0)};
  }

  &:hover {
    color: ${p => p.theme.textColor};

    &:before {
      opacity: 1;
    }
  }

  svg {
    flex-shrink: 0;
  }
`;
