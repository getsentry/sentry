import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import Link from 'sentry/components/links/link';
import {
  IconChevron,
  IconCircle,
  IconCode,
  IconExpand,
  IconFile,
  IconGrid,
  IconNumber,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {space} from 'sentry/styles/space';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import {useLocation} from 'sentry/utils/useLocation';

class StoryTreeNode {
  public name: string;
  public path: string;
  public visible = true;
  public expanded = false;
  public children: Record<string, StoryTreeNode> = {};

  public result: ReturnType<typeof fzf> | null = null;

  constructor(name: string, path: string) {
    this.name = name;
    this.path = path;
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

  const aIsFolder = Object.keys(a[1].children).length > 0;
  const bIsFolder = Object.keys(b[1].children).length > 0;

  if (aIsFolder && !bIsFolder) {
    return -1;
  }

  if (!aIsFolder && bIsFolder) {
    return 1;
  }

  return a[0].localeCompare(b[0]);
}

const order: FileCategory[] = ['components', 'hooks', 'views', 'assets', 'styles'];
function rootCategorySort(
  a: [FileCategory | string, StoryTreeNode],
  b: [FileCategory | string, StoryTreeNode]
) {
  return order.indexOf(a[0] as FileCategory) - order.indexOf(b[0] as FileCategory);
}

function normalizeFilename(filename: string) {
  // Do not uppercase the first three characters of the filename
  if (filename.startsWith('use')) {
    return filename.replace('.stories.tsx', '');
  }

  // capitalizes the filename
  return filename.charAt(0).toUpperCase() + filename.slice(1).replace('.stories.tsx', '');
}

type FileCategory = 'hooks' | 'components' | 'views' | 'styles' | 'assets';

function inferFileCategory(path: string): FileCategory {
  const parts = path.split('/');
  const filename = parts.at(-1);
  if (filename?.startsWith('use')) {
    return 'hooks';
  }

  if (parts[1]?.startsWith('icons') || path.endsWith('images.stories.tsx')) {
    return 'assets';
  }

  if (parts[1]?.startsWith('views')) {
    return 'views';
  }

  if (parts[1]?.startsWith('styles')) {
    return 'styles';
  }

  return 'components';
}

function inferComponentName(path: string): string {
  const parts = path.split('/');

  let part = parts.pop();
  while (part?.startsWith('index.')) {
    part = parts.pop();
  }

  return part ?? '';
}

export function useStoryTree(
  files: string[],
  options: {query: string; representation: 'filesystem' | 'category'}
) {
  const location = useLocation();
  const initialName = useRef(location.query.name);

  const tree = useMemo(() => {
    const root = new StoryTreeNode('root', '');

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
              parts.slice(0, i + 1).join('/')
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
        const name = inferComponentName(file);

        if (!root.children[type]) {
          root.children[type] = new StoryTreeNode(type, type);
        }

        if (!root.children[type].children[name]) {
          root.children[type].children[name] = new StoryTreeNode(name, file);
        } else {
          throw new Error(
            `Naming conflict found between ${file} and ${root.children[type].children[name].path}`
          );
        }
      }

      // Sort the root by category order when using the category representation
      root.children = Object.fromEntries(
        Object.entries(root.children).sort(rootCategorySort)
      );
      // Sort the children of each category by file, folder or alphabetically
      for (const key in root.children) {
        root.children[key]!.sort(folderOrSearchScoreFirst);
      }
    }

    // If the user navigates to a story, expand to its location in the tree
    if (initialName.current) {
      for (const {node, path} of root) {
        if (node.path === initialName.current) {
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

  return nodes;
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
        <IconChevron size="xs" direction={expanded ? 'down' : 'right'} />
        {normalizeFilename(props.node.name)}
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
  const query = qs.stringify({...location.query, name: props.node.path});
  const category = props.node.path.split('/').at(1) ?? 'default';

  return (
    <li>
      <FolderLink
        to={`/stories/?${query}`}
        active={location.query.name === props.node.path}
      >
        <StoryIcon category={category} />
        {/* @TODO (JonasBadalic): Do we need to show the file extension? */}
        {normalizeFilename(props.node.name)}
      </FolderLink>
    </li>
  );
}

function StoryIcon(props: {
  category: 'components' | 'icons' | 'styles' | 'utils' | 'views' | (string & {});
}) {
  const iconProps: SVGIconProps = {size: 'xs'};
  switch (props.category) {
    case 'components':
      return <IconGrid {...iconProps} />;
    case 'icons':
      return <IconExpand {...iconProps} />;
    case 'styles':
      return <IconCircle {...iconProps} />;
    case 'utils':
      return <IconCode {...iconProps} />;
    case 'views':
      return <IconNumber {...iconProps} />;
    default:
      return <IconFile {...iconProps} />;
  }
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
