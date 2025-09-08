import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';
import kebabCase from 'lodash/kebabCase';

import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import {useLocation} from 'sentry/utils/useLocation';

export class StoryTreeNode {
  public name: string;
  public label: string;
  public path: string;
  public filesystemPath: string;
  public category: StoryCategory;
  public location: LocationDescriptorObject;

  public visible = true;
  public expanded = false;
  public children: Record<string, StoryTreeNode> = {};

  public result: ReturnType<typeof fzf> | null = null;

  constructor(name: string, path: string, filesystemPath: string) {
    this.name = name;
    this.label = normalizeFilename(name);
    this.path = path;
    this.filesystemPath = filesystemPath;
    this.category = inferFileCategory(filesystemPath);
    this.location = this.getLocation();
  }

  private getLocation(): LocationDescriptorObject {
    const state = {storyPath: this.filesystemPath};
    if (this.category === 'shared') {
      return {pathname: '/stories/', query: {name: this.filesystemPath}, state};
    }
    return {
      pathname: `/stories/${this.category}/${kebabCase(this.label)}`,
      state,
    };
  }

  find(predicate: (node: StoryTreeNode) => boolean): StoryTreeNode | undefined {
    for (const {node} of this) {
      if (predicate(node)) {
        return node;
      }
    }
    return undefined;
  }

  sort(predicate: (a: [string, StoryTreeNode], b: [string, StoryTreeNode]) => number) {
    this.children = Object.fromEntries(Object.entries(this.children).sort(predicate));

    for (const {node} of this) {
      node.children = Object.fromEntries(Object.entries(node.children).sort(predicate));
    }
  }

  // Iterator that yields all files in the tree, excluding folders
  *[Symbol.iterator]() {
    function* recurse(
      node: StoryTreeNode,
      path: StoryTreeNode[]
    ): Generator<{node: StoryTreeNode; path: StoryTreeNode[]}> {
      yield {node, path};

      for (const child of Object.values(node.children)) {
        yield* recurse(child, path.concat(node));
      }
    }

    yield* recurse(this, []);
  }

  flat() {
    const flattened: StoryTreeNode[] = [];
    for (const {node} of this) {
      if (Object.keys(node.children).length === 0) {
        flattened.push(node);
      }
    }
    return flattened;
  }
}

function isFolderNode(
  node: StoryTreeNode
): node is StoryTreeNode & {children: Record<string, StoryTreeNode>} {
  return Object.keys(node.children).length > 0;
}

function folderOrSearchScoreFirst(
  a: [string, StoryTreeNode],
  b: [string, StoryTreeNode]
) {
  if (a[1].visible && !b[1].visible) {
    return -1;
  }

  if (!a[1].visible && b[1].visible) {
    return 1;
  }

  if (a[1].result && b[1].result) {
    if (a[1].result.score === b[1].result.score) {
      return a[0].localeCompare(b[0]);
    }
    return b[1].result.score - a[1].result.score;
  }

  const aIsFolder = isFolderNode(a[1]);
  const bIsFolder = isFolderNode(b[1]);

  if (aIsFolder && !bIsFolder) {
    return -1;
  }

  if (!aIsFolder && bIsFolder) {
    return 1;
  }

  return a[0].localeCompare(b[0]);
}

const order: StoryCategory[] = [
  'foundations',
  'typography',
  'layout',
  'core',
  'product',
  'shared',
];
function rootCategorySort(
  a: [StoryCategory | string, StoryTreeNode],
  b: [StoryCategory | string, StoryTreeNode]
) {
  if (isFolderNode(a[1]) && isFolderNode(b[1])) {
    return a[0].localeCompare(b[0]);
  }

  if (isFolderNode(a[1]) && !isFolderNode(b[1])) {
    return 1;
  }

  if (!isFolderNode(a[1]) && isFolderNode(b[1])) {
    return -1;
  }

  if (order.includes(a[0] as StoryCategory) && order.includes(b[0] as StoryCategory)) {
    return order.indexOf(a[0] as StoryCategory) - order.indexOf(b[0] as StoryCategory);
  }

  return a[0].localeCompare(b[0]);
}

function normalizeFilename(filename: string) {
  // Do not uppercase the first three characters of the filename
  if (filename.startsWith('use')) {
    return filename.replace('.stories.tsx', '');
  }

  // capitalizes the filename
  return (
    filename.charAt(0).toUpperCase() +
    filename.slice(1).replace('.stories.tsx', '').replace('.mdx', '')
  );
}

export type StoryCategory =
  | 'foundations'
  | 'core'
  | 'product'
  | 'typography'
  | 'layout'
  | 'shared';

export function inferFileCategory(path: string): StoryCategory {
  if (isFoundationFile(path)) {
    return 'foundations';
  }

  if (isTypographyFile(path)) {
    return 'typography';
  }

  if (isLayoutFile(path)) {
    return 'layout';
  }

  // Leave core at the end, as both typography and layout are considered core components
  if (isCoreFile(path)) {
    return 'core';
  }

  if (isProductFile(path)) {
    return 'product';
  }

  return 'shared';
}

function isCoreFile(file: string) {
  return file.includes('components/core');
}

function isFoundationFile(file: string) {
  return file.includes('app/styles') || file.includes('app/icons');
}

function isTypographyFile(file: string) {
  return file.includes('components/core/text');
}

function isLayoutFile(file: string) {
  return file.includes('components/core/layout');
}

function isProductFile(path: string): boolean {
  if (path.includes('/views/insights/')) {
    return true;
  }

  return false;
}

function inferProductVertical(path: string): string | null {
  if (path.includes('/views/insights/')) {
    return 'Insights';
  }

  return null;
}

function inferComponentName(path: string): string {
  const parts = path.split('/');

  let part = parts.pop();
  while (part?.startsWith('index.')) {
    part = parts.pop();
  }

  return part ?? '';
}

function inferComponentPath(path: string): string {
  const parts = path.split('/');
  const last = parts.at(-1);

  if (last?.startsWith('index.')) {
    parts.pop();
    parts.push(parts.pop()!);
  }

  return path
    .replace('/components/core', '/components/')
    .replace('/styles', '/')
    .replace('/icons', '/');
}

export function useStoryTree(
  files: string[],
  options: {
    query: string;
    representation: 'filesystem' | 'category';
    type?: 'flat' | 'nested';
  }
) {
  const location = useLocation();
  const initialName = useRef(location.state?.storyPath ?? location.query.name);

  const tree = useMemo(() => {
    const root = new StoryTreeNode('root', '', '');

    if (options.representation === 'filesystem') {
      for (const file of files) {
        const parts = file.split('/');
        let parent = root;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part) {
            continue;
          }
          if (!(part in parent.children)) {
            parent.children[part] = new StoryTreeNode(
              part,
              parts.slice(0, i + 1).join('/'),
              file
            );
          }

          parent = parent.children[part]!;
        }
      }

      // Sort the root by file/folder name when using the filesystem representation
      root.sort(folderOrSearchScoreFirst);
    } else if (options.representation === 'category') {
      for (const file of files) {
        const type = inferFileCategory(file);
        const path = inferComponentPath(file);
        const name = inferComponentName(file);
        const vertical = inferProductVertical(file);

        if (!root.children[type]) {
          root.children[type] = new StoryTreeNode(type, type, file);
        }

        let parent = root.children[type];
        let parts = path.split('/');

        // If 'app' is present in parts, insert the vertical after 'app'
        const appIndex = parts.indexOf('app');
        if (appIndex !== -1 && vertical) {
          if (parts[appIndex + 1] !== vertical) {
            parts = [
              ...parts.slice(0, appIndex + 1),
              vertical,
              ...parts.slice(appIndex + 1),
            ];
          }
        }

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part) {
            continue;
          }

          if (i === parts.length - 1) {
            parent.children[name] = new StoryTreeNode(name, type, file);
            break;
          }

          if (!(part in parent.children)) {
            parent.children[part] = new StoryTreeNode(
              part,
              parts.slice(0, i + 1).join('/'),
              file
            );
          }

          parent = parent.children[part]!;
        }
      }

      // Sort the root by category order when using the category representation
      root.children = Object.fromEntries(
        Object.entries(root.children).sort(rootCategorySort)
      );
      // Sort the children of each category by file, folder or alphabetically
      Object.values(root.children).forEach(child => {
        child.sort(folderOrSearchScoreFirst);
      });
    }

    // If the user navigates to a story, expand to its location in the tree
    if (initialName.current) {
      for (const {node, path} of root) {
        if (node.filesystemPath === initialName.current) {
          for (const p of path) {
            p.expanded = true;
          }
          break;
        }
      }
    }

    return root;
  }, [files, options.representation]);

  const nodes = useMemo(() => {
    // Skip the top level app folder as it's where the entire project is at
    const root = tree.find(node => node.name === 'app') ?? tree;

    if (!options.query) {
      if (initialName.current) {
        initialName.current = null;
      }

      // If there is no initial query and no story is selected, the sidebar
      // tree is collapsed to the root node.
      for (const {node} of root) {
        node.visible = true;
        node.expanded = false;
        node.result = null;
      }

      // sort alphabetically or by category
      if (options.representation === 'filesystem') {
        root.sort(folderOrSearchScoreFirst);
      } else {
        root.children = Object.fromEntries(
          Object.entries(root.children).sort(rootCategorySort)
        );
      }
      return Object.values(root.children);
    }

    for (const {node} of root) {
      node.visible = false;
      node.expanded = false;
      node.result = null;
    }

    // Fzf requires the input to be lowercase as it normalizes the search candidates to lowercase
    const lowerCaseQuery = options.query.toLowerCase();

    for (const {node, path} of root) {
      // index files are useless when trying to match by name, so we'll special
      // case them and match by their full path as it'll contain a more
      // relevant path that we can match against.
      const name = node.name.startsWith('index.')
        ? [node.name, ...path.map(p => p.name)].join('.')
        : node.name;

      const match = fzf(name, lowerCaseQuery, false);
      node.result = match;

      if (match.score > 0) {
        node.visible = true;

        if (Object.keys(node.children).length > 0) {
          node.expanded = true;
          for (const child of Object.values(node.children)) {
            child.visible = true;
          }
        }

        // @TODO (JonasBadalic): We can trip this when we find a visible node if we reverse iterate
        for (const p of path) {
          p.visible = true;
          p.expanded = true;
          // The entire path needs to contain max score of its child results so that
          // the entire path to it can be sorted by this score. The side effect of this is that results from the same
          // tree path with a lower score will be placed higher in the tree if that same path has a higher score anywhere
          // in the tree. This isn't ideal, but given that it favors the most relevant results, it makes it a good starting point.
          p.result = match.score > (p.result?.score ?? 0) ? match : p.result;
        }
      }
    }

    root.sort(folderOrSearchScoreFirst);

    return Object.values(root.children);
  }, [tree, options.query, options.representation]);
  const result = useMemo(() => {
    if (options.type === 'flat') {
      return nodes.flatMap(node => node.flat(), 1);
    }
    return nodes;
  }, [nodes, options.type]);

  return result;
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  nodes: StoryTreeNode[];
}

// @TODO (JonasBadalic): Implement treeview pattern navigation
// https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
export function StoryTree({nodes, ...htmlProps}: Props) {
  return (
    <nav {...htmlProps}>
      <StoryList>
        {nodes.map(node => {
          if (!node.visible) {
            return null;
          }

          return Object.keys(node.children).length === 0 ? (
            <File node={node} key={node.name} />
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
  const location = useLocation();
  const hasActiveChild = useMemo(() => {
    const child = props.node.find(
      n => n.filesystemPath === (location.state?.storyPath ?? location.query.name)
    );
    return !!child;
  }, [location, props.node]);

  if (hasActiveChild && !props.node.expanded) {
    props.node.expanded = true;
    setExpanded(true);
  }

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
          if (props.node.expanded) {
            for (const child of Object.values(props.node.children)) {
              child.visible = true;
            }
          }
          setExpanded(props.node.expanded);
        }}
      >
        <Flex flex={1}>{normalizeFilename(props.node.name)}</Flex>
        <IconChevron size="xs" direction={expanded ? 'down' : 'right'} />
      </FolderName>
      {expanded && Object.keys(props.node.children).length > 0 && (
        <StoryList>
          {Object.values(props.node.children).map(child => {
            if (!child.visible) {
              return null;
            }
            return Object.keys(child.children).length === 0 ? (
              <File key={child.path} node={child} />
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
  const {state, ...to} = props.node.location;
  const active =
    props.node.filesystemPath === (location.state?.storyPath ?? location.query.name);

  return (
    <li>
      <FolderLink
        to={to}
        state={state}
        aria-current={active ? 'page' : undefined}
        active={active}
      >
        {normalizeFilename(props.node.name)}
      </FolderLink>
    </li>
  );
}

const StoryList = styled('ul')`
  list-style-type: none;
  padding-left: 16px;

  &:first-child {
    padding-left: 0;
  }
`;

const FolderName = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
  padding: ${space(1)} ${space(2)} ${space(1)} ${space(1)};
  color: ${p => p.theme.tokens.content.muted};
  cursor: pointer;
  position: relative;

  &:before {
    background: ${p => p.theme.gray100};
    content: '';
    inset: 0 ${space(0.25)} 0 -${space(0.25)};
    position: absolute;
    z-index: -1;
    border-radius: ${p => p.theme.borderRadius};
    opacity: 0;
  }

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
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
  gap: ${space(0.5)};
  color: ${p =>
    p.active ? p.theme.tokens.content.accent : p.theme.tokens.content.muted};
  padding: ${space(1)} ${space(1)} ${space(1)} ${space(0.75)};
  position: relative;
  transition: none;

  &:before {
    background: ${p =>
      p.theme.isChonk ? (p.theme as any).colors.blue100 : p.theme.blue100};
    content: '';
    inset: 0 ${space(1)} 0 -${space(0.25)};
    position: absolute;
    z-index: -1;
    border-radius: ${p => p.theme.borderRadius};
    opacity: ${p => (p.active ? 1 : 0)};
    transition: none;
  }

  &:after {
    content: '';
    position: absolute;
    left: -8px;
    height: 20px;
    background: ${p => p.theme.tokens.graphics.accent};
    width: 4px;
    border-radius: ${p => p.theme.borderRadius};
    opacity: ${p => (p.active ? 1 : 0)};
    transition: none;
  }

  &:hover {
    color: ${p =>
      p.active ? p.theme.tokens.content.accent : p.theme.tokens.content.primary};

    &:before {
      background: ${p => (p.active ? p.theme.blue100 : p.theme.gray100)};
      opacity: 1;
    }
  }

  &:active {
    color: ${p =>
      p.active ? p.theme.tokens.content.accent : p.theme.tokens.content.primary};

    &:before {
      background: ${p => (p.active ? p.theme.blue200 : p.theme.gray200)};
      opacity: 1;
    }
  }

  svg {
    flex-shrink: 0;
  }
`;
