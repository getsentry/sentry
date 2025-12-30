import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {IconChevron} from 'sentry/icons';
import {useStoryParams} from 'sentry/stories/view';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';

import {useStoryBookFiles} from './useStoriesLoader';

export class StoryTreeNode {
  public name: string;
  public label: string;
  public path: string;
  public filesystemPath: string;
  public category: StoryCategory;
  public slug: string | undefined = undefined;

  public visible = true;
  public expanded = false;
  public children: Record<string, StoryTreeNode> = {};

  public result: ReturnType<typeof fzf> | null = null;

  constructor(name: string, path: string, filesystemPath: string) {
    this.name = name;
    this.path = path;
    this.filesystemPath = filesystemPath;
    this.label = normalizeFilename(name);
    this.category = inferFileCategory(filesystemPath);

    if (this.category === 'product') {
      const [_app, ...segments] = this.filesystemPath.split('/');
      // Remove the filename from the path
      segments.pop()!;
      const pathPrefix =
        segments.length > 0
          ? `${segments.map(segment => segment.toLowerCase()).join('/')}/`
          : '';
      this.slug = `${pathPrefix}${this.label.replaceAll(' ', '-').toLowerCase()}`;
    } else {
      this.slug = `${this.label.replaceAll(' ', '-').toLowerCase()}`;
    }
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

export type StoryCategory = 'principles' | 'patterns' | 'core' | 'product';

type StorySection = 'overview' | StoryCategory;

type ComponentSubcategory =
  | 'typography'
  | 'layout'
  | 'buttons'
  | 'forms'
  | 'pickers'
  | 'navigation'
  | 'status-feedback'
  | 'data-display'
  | 'overlays'
  | 'utilities'
  | 'shared';

export const SECTION_CONFIG: Record<StorySection, {label: string}> = {
  overview: {label: 'Overview'},
  principles: {label: 'Principles'},
  patterns: {label: 'Patterns'},
  core: {label: 'Components'},
  product: {label: 'Shared'},
};

export const COMPONENT_SUBCATEGORY_CONFIG: Record<
  ComponentSubcategory,
  {
    components: string[];
    label: string;
  }
> = {
  layout: {
    label: 'Layout',
    components: ['composition', 'container', 'flex', 'grid', 'stack'],
  },
  typography: {
    label: 'Typography',
    components: ['heading', 'prose', 'text', 'inlinecode', 'quote'],
  },
  buttons: {
    label: 'Buttons',
    components: ['button', 'linkbutton', 'buttonbar'],
  },
  forms: {
    label: 'Forms',
    components: [
      'input',
      'inputgroup',
      'numberinput',
      'numberdraginput',
      'checkbox',
      'radio',
      'switch',
      'slider',
    ],
  },
  pickers: {
    label: 'Pickers',
    components: [
      'select',
      'multiselect',
      'compactselect',
      'composite',
      'segmentedcontrol',
    ],
  },
  navigation: {
    label: 'Navigation',
    components: ['link', 'tabs', 'menulistitem', 'disclosure'],
  },
  'status-feedback': {
    label: 'Status & Feedback',
    components: ['alert', 'badge', 'toast'],
  },
  'data-display': {
    label: 'Data Display',
    components: ['avatar', 'image', 'codeblock'],
  },
  overlays: {
    label: 'Overlays',
    components: ['slideoverpanel', 'tooltip'],
  },
  utilities: {
    label: 'Utilities',
    components: ['separator', 'interactionstatelayer'],
  },
  shared: {
    label: 'Shared',
    components: [],
  },
};

export const SECTION_ORDER: StorySection[] = [
  'overview',
  'principles',
  'patterns',
  'core',
  'product',
];

export const COMPONENT_SUBCATEGORY_ORDER: ComponentSubcategory[] = [
  'layout',
  'typography',
  'buttons',
  'forms',
  'pickers',
  'navigation',
  'status-feedback',
  'data-display',
  'overlays',
  'utilities',
  'shared',
];

// Hierarchical structure for sidebar rendering
interface StoryHierarchyData {
  stories: StoryTreeNode[];
}

/**
 * Returns a flat array of all stories in display order (for pagination).
 * Stories are ordered by section, then by subcategory within components.
 */
export function useFlatStoryList(): StoryTreeNode[] {
  const files = useStoryBookFiles();

  return useMemo(() => {
    const result: StoryTreeNode[] = [];

    // Group files by section and subcategory
    const grouped = new Map<
      StorySection,
      {bySubcategory: Map<ComponentSubcategory, string[]>; direct: string[]}
    >();

    for (const section of SECTION_ORDER) {
      grouped.set(section, {direct: [], bySubcategory: new Map()});
    }

    for (const file of files) {
      const loc = inferStoryLocation(file);
      const sectionData = grouped.get(loc.section);
      if (!sectionData) {
        continue;
      }

      if (loc.subcategory) {
        if (!sectionData.bySubcategory.has(loc.subcategory)) {
          sectionData.bySubcategory.set(loc.subcategory, []);
        }
        sectionData.bySubcategory.get(loc.subcategory)!.push(file);
      } else {
        sectionData.direct.push(file);
      }
    }

    // Build flat list in order
    for (const section of SECTION_ORDER) {
      const sectionData = grouped.get(section)!;

      // Add direct stories for this section
      for (const file of sectionData.direct.sort()) {
        const name = inferComponentName(file);
        const node = new StoryTreeNode(formatName(name), section, file);
        result.push(node);
      }

      if (section === 'core') {
        for (const subcategory of COMPONENT_SUBCATEGORY_ORDER) {
          const subcategoryFiles = sectionData.bySubcategory.get(subcategory);
          if (!subcategoryFiles) {
            continue;
          }

          for (const file of subcategoryFiles.sort()) {
            const name = inferComponentName(file);
            const node = new StoryTreeNode(formatName(name), 'core', file);
            result.push(node);
          }
        }
      }
    }

    return result;
  }, [files]);
}

/**
 * Returns a hierarchical structure for sidebar rendering.
 * Sections contain stories, and the components section has subcategories.
 */
export function useStoryHierarchy(): Map<StorySection, StoryHierarchyData> {
  const files = useStoryBookFiles();

  return useMemo(() => {
    const hierarchy = new Map<StorySection, StoryHierarchyData>();

    // Initialize sections (all use same structure now)
    for (const section of SECTION_ORDER) {
      hierarchy.set(section, {stories: []});
    }

    // Collect files by section
    const productFiles: string[] = [];
    const coreFilesBySubcategory = new Map<ComponentSubcategory, string[]>();

    for (const file of files) {
      const loc = inferStoryLocation(file);
      const sectionData = hierarchy.get(loc.section);
      if (!sectionData) {
        continue;
      }

      // Special handling for 'product' section - collect files for tree building
      if (loc.section === 'product') {
        productFiles.push(file);
        continue;
      }

      // Special handling for 'core' section - collect by subcategory
      if (loc.section === 'core' && loc.subcategory) {
        if (!coreFilesBySubcategory.has(loc.subcategory)) {
          coreFilesBySubcategory.set(loc.subcategory, []);
        }
        coreFilesBySubcategory.get(loc.subcategory)!.push(file);
        continue;
      }

      // Other sections: add directly
      const name = inferComponentName(file);
      const node = new StoryTreeNode(formatName(name), loc.section, file);
      sectionData.stories.push(node);
    }

    // Build tree structure for 'product'/'Shared' section
    if (productFiles.length > 0) {
      const productTree = buildProductTree(productFiles);
      hierarchy.set('product', {stories: productTree});
    }

    // Build tree structure for 'core'/'Components' section
    if (coreFilesBySubcategory.size > 0) {
      const componentTree = buildComponentTree(coreFilesBySubcategory);
      hierarchy.set('core', {stories: componentTree});
    }

    // Sort stories within each section
    for (const [section, sectionData] of hierarchy) {
      // Skip 'product' and 'core' - already sorted by tree builders
      if (section === 'product' || section === 'core') {
        continue;
      }

      sectionData.stories.sort((a, b) => a.label.localeCompare(b.label));
    }

    return hierarchy;
  }, [files]);
}

function inferFileCategory(path: string): StoryCategory {
  if (isPrinciplesFile(path)) {
    return 'principles';
  }

  if (isPatternsFile(path)) {
    return 'patterns';
  }

  if (isCoreFile(path)) {
    return 'core';
  }

  return 'product';
}

// New hierarchical inference system
interface StoryLocation {
  section: StorySection;
  subcategory?: ComponentSubcategory;
}

function inferStoryLocation(path: string): StoryLocation {
  // Overview section
  if (isOverviewFile(path)) {
    return {section: 'overview'};
  }

  // Principles (includes old foundations: styles, icons)
  if (isPrinciplesFile(path)) {
    return {section: 'principles'};
  }

  // Patterns
  if (isPatternsFile(path)) {
    return {section: 'patterns'};
  }

  // Components - determine subcategory
  if (isCoreFile(path)) {
    const componentName = inferComponentName(path).toLowerCase();
    const subcategory = inferComponentSubcategory(componentName);
    return {section: 'core', subcategory};
  }

  // Shared (non-core components)
  return {section: 'product'};
}

function inferComponentSubcategory(componentName: string): ComponentSubcategory {
  for (const [subcategory, config] of Object.entries(COMPONENT_SUBCATEGORY_CONFIG)) {
    if (config.components.includes(componentName)) {
      return subcategory as ComponentSubcategory;
    }
  }
  return 'shared';
}

function isOverviewFile(file: string) {
  return file.includes('components/core/overview');
}

// New: includes old foundations (styles, icons) merged into principles
function isPrinciplesFile(file: string) {
  return (
    file.includes('app/styles') ||
    file.includes('app/icons') ||
    file.includes('components/core/principles')
  );
}

function isCoreFile(file: string) {
  return file.includes('components/core');
}

function isPatternsFile(file: string) {
  return file.includes('components/core/patterns');
}

function inferComponentName(path: string): string {
  const parts = path.split('/');

  let part = parts.pop();
  while (part?.startsWith('index.')) {
    part = parts.pop();
  }

  // Remove file extensions (.stories.tsx, .mdx, etc.)
  return (part ?? '').replace(/\.(stories\.tsx|mdx)$/, '');
}

function formatName(name: string) {
  return name
    .split('-')
    .map(word =>
      word === 'and' || word === 'or'
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');
}

/**
 * Builds a nested tree structure from flat product/shared file paths.
 * Strips 'app/' prefix and creates intermediate folder nodes.
 * Example: "app/components/forms/form.stories.tsx" → components/forms/Form
 */
function buildProductTree(files: string[]): StoryTreeNode[] {
  const root = new StoryTreeNode('root', '', '');

  for (const file of files) {
    // Strip 'app/' prefix, keep rest of path
    const normalizedPath = file.replace(/^app\//, '');
    const parts = normalizedPath.split('/');

    let currentNode = root;

    // Build folder hierarchy (all parts except filename)
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part) {
        if (!currentNode.children[part]) {
          // Create intermediate folder node
          const folderPath = parts.slice(0, i + 1).join('/');
          currentNode.children[part] = new StoryTreeNode(
            part,
            folderPath,
            file // Keep original file path for routing
          );
        }

        currentNode = currentNode.children[part];
      }
    }

    // Add the actual story file as leaf node
    const name = inferComponentName(file);
    currentNode.children[name] = new StoryTreeNode(formatName(name), 'product', file);
  }

  // Sort recursively: folders first, then alphabetically
  sortTreeRecursively(root);

  // Return top-level children (components/, utils/, etc.)
  return Object.values(root.children);
}

function sortTreeRecursively(node: StoryTreeNode) {
  const entries = Object.entries(node.children).sort((a, b) => {
    const aIsFolder = Object.keys(a[1].children).length > 0;
    const bIsFolder = Object.keys(b[1].children).length > 0;

    // Folders before files
    if (aIsFolder && !bIsFolder) {
      return -1;
    }
    if (!aIsFolder && bIsFolder) {
      return 1;
    }

    // Alphabetically within same type
    return a[0].localeCompare(b[0]);
  });

  node.children = Object.fromEntries(entries);

  // Recursively sort children
  for (const child of Object.values(node.children)) {
    sortTreeRecursively(child);
  }
}

/**
 * Builds a nested tree structure from component files grouped by subcategory.
 * Creates folder nodes for each subcategory (Typography, Buttons, Layout, etc.).
 */
function buildComponentTree(
  filesBySubcategory: Map<ComponentSubcategory, string[]>
): StoryTreeNode[] {
  const roots: StoryTreeNode[] = [];

  // Iterate in display order
  for (const subcategory of COMPONENT_SUBCATEGORY_ORDER) {
    const files = filesBySubcategory.get(subcategory);
    if (!files || files.length === 0) {
      continue;
    }

    // Create folder node for subcategory
    const label = COMPONENT_SUBCATEGORY_CONFIG[subcategory].label;
    if (files[0]) {
      const folderNode = new StoryTreeNode(label, subcategory, files[0]);

      // Add component stories as children
      for (const file of files.sort()) {
        const name = inferComponentName(file);
        folderNode.children[name] = new StoryTreeNode(formatName(name), 'core', file);
      }

      roots.push(folderNode);
    }
  }

  return roots;
}

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  nodes: StoryTreeNode[];
}

// @TODO (JonasBadalic): Implement treeview pattern navigation
// https://www.w3.org/WAI/ARIA/apg/patterns/treeview/
function StoryTree({nodes, ...htmlProps}: Props) {
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

/**
 * Renders the full sidebar with hierarchical sections and component subcategories.
 * All subcategories are collapsible sections using StoryTree.
 */
export function CategorizedStoryTree() {
  const hierarchy = useStoryHierarchy();

  return (
    <ul>
      {SECTION_ORDER.map(section => {
        const data = hierarchy.get(section);
        if (!data || data.stories.length === 0) {
          return null;
        }

        return (
          <li key={section}>
            <SectionHeader>{SECTION_CONFIG[section].label}</SectionHeader>
            <StoryTree nodes={data.stories} />
          </li>
        );
      })}
    </ul>
  );
}

function Folder(props: {node: StoryTreeNode}) {
  const [expanded, setExpanded] = useState(props.node.expanded);
  const {storySlug} = useStoryParams();

  const hasActiveChild = useMemo(() => {
    // eslint-disable-next-line unicorn/prefer-array-some
    return !!props.node.find(n => n.slug === storySlug);
  }, [storySlug, props.node]);

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
              <File key={child.slug} node={child} />
            ) : (
              <Folder key={child.slug} node={child} />
            );
          })}
        </StoryList>
      )}
    </li>
  );
}

function File(props: {node: StoryTreeNode}) {
  const organization = useOrganization();
  const {storySlug} = useStoryParams();
  const active = storySlug === props.node.slug;

  return (
    <li>
      <FolderLink
        to={{
          pathname: normalizeUrl(
            `/organizations/${organization.slug}/stories/${props.node.category}/${props.node.slug}/`
          ),
        }}
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
  padding-left: ${p => p.theme.space.xl};

  &:first-child {
    padding-left: 0;
  }
`;

const SectionHeader = styled('h3')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
  padding: ${p => p.theme.space.md};
`;

const FolderName = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.md};
  padding-right: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.muted};
  cursor: pointer;
  position: relative;

  &:before {
    background: ${p => p.theme.colors.gray100};
    content: '';
    inset: 0 ${p => p.theme.space['2xs']} 0 -${p => p.theme.space['2xs']};
    position: absolute;
    z-index: -1;
    border-radius: ${p => p.theme.radius.md};
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
  gap: ${p => p.theme.space.xs};
  color: ${p =>
    p.active ? p.theme.tokens.content.accent : p.theme.tokens.content.muted};
  padding: ${p => p.theme.space.md};
  padding-left: ${p => p.theme.space.sm};
  position: relative;
  transition: none;

  &:before {
    background: ${p => p.theme.colors.blue100};
    content: '';
    inset: 0 ${p => p.theme.space.md} 0 -${p => p.theme.space['2xs']};
    position: absolute;
    z-index: -1;
    border-radius: ${p => p.theme.radius.md};
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
    border-radius: ${p => p.theme.radius.md};
    opacity: ${p => (p.active ? 1 : 0)};
    transition: none;
  }

  &:hover {
    color: ${p =>
      p.active ? p.theme.tokens.content.accent : p.theme.tokens.content.primary};

    &:before {
      background: ${p => (p.active ? p.theme.colors.blue100 : p.theme.colors.gray100)};
      opacity: 1;
    }
  }

  &:active {
    color: ${p =>
      p.active ? p.theme.tokens.content.accent : p.theme.tokens.content.primary};

    &:before {
      background: ${p => (p.active ? p.theme.colors.blue200 : p.theme.colors.gray200)};
      opacity: 1;
    }
  }

  svg {
    flex-shrink: 0;
  }
`;
