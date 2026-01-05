import {useMemo} from 'react';
import styled from '@emotion/styled';

import {unreachable} from 'sentry/utils/unreachable';

import type {StoryTreeNode} from './storyTree';
import {inferFileCategory, StoryTree, useStoryTree} from './storyTree';
import {useStoryBookFiles} from './useStoriesLoader';

export function StorySidebar() {
  const {foundations, principles, patterns, typography, layout, core, product, shared} =
    useStoryBookFilesByCategory();

  return (
    <SidebarContainer key="sidebar" ref={scrollIntoView}>
      <ul>
        <li>
          <h3>Foundations</h3>
          <StoryTree nodes={foundations} />
        </li>
        {principles.length > 0 && (
          <li>
            <h3>Principles</h3>
            <StoryTree nodes={principles} />
          </li>
        )}
        {patterns.length > 0 && (
          <li>
            <h3>Patterns</h3>
            <StoryTree nodes={patterns} />
          </li>
        )}
        <li>
          <h3>Typography</h3>
          <StoryTree nodes={typography} />
        </li>
        <li>
          <h3>Layout</h3>
          <StoryTree nodes={layout} />
        </li>
        <li>
          <h3>Components</h3>
          <StoryTree nodes={core} />
        </li>
        {product.length > 0 ? (
          <li>
            <h3>Product</h3>
            <StoryTree nodes={product} />
          </li>
        ) : null}
        <li>
          <h3>Shared</h3>
          <StoryTree nodes={shared} />
        </li>
      </ul>
    </SidebarContainer>
  );
}

function scrollIntoView(node: HTMLElement | null) {
  node
    ?.querySelector('[aria-current="page"]')
    ?.scrollIntoView({behavior: 'instant', block: 'nearest'});
}

export function useStoryBookFilesByCategory(): Record<
  | 'foundations'
  | 'principles'
  | 'patterns'
  | 'typography'
  | 'layout'
  | 'core'
  | 'product'
  | 'shared',
  StoryTreeNode[]
> {
  const files = useStoryBookFiles();
  const filesByOwner = useMemo(() => {
    // The order of keys here is important and used by the pagination in storyFooter
    const map: Record<ReturnType<typeof inferFileCategory>, string[]> = {
      foundations: [],
      principles: [],
      patterns: [],
      typography: [],
      layout: [],
      core: [],
      product: [],
      shared: [],
    };

    for (const file of files) {
      const category = inferFileCategory(file);
      switch (category) {
        case 'foundations':
          map.foundations.push(file);
          break;
        case 'principles':
          map.principles.push(file);
          break;
        case 'patterns':
          map.patterns.push(file);
          break;
        case 'typography':
          map.typography.push(file);
          break;
        case 'layout':
          map.layout.push(file);
          break;
        case 'core':
          map.core.push(file);
          break;
        case 'product':
          map.product.push(file);
          break;
        case 'shared':
          map.shared.push(file);
          break;
        default:
          unreachable(category);
      }
    }
    return map;
  }, [files]);

  const foundations = useStoryTree(filesByOwner.foundations, {
    query: '',
    representation: 'category',
    type: 'flat',
  });
  const principles = useStoryTree(filesByOwner.principles, {
    query: '',
    representation: 'category',
    type: 'flat',
  });
  const patterns = useStoryTree(filesByOwner.patterns, {
    query: '',
    representation: 'category',
    type: 'flat',
  });
  const typography = useStoryTree(filesByOwner.typography, {
    query: '',
    representation: 'category',
    type: 'flat',
  });
  const core = useStoryTree(filesByOwner.core, {
    query: '',
    representation: 'category',
    type: 'flat',
  });
  const layout = useStoryTree(filesByOwner.layout, {
    query: '',
    representation: 'category',
    type: 'flat',
  });
  const product = useStoryTree(filesByOwner.product, {
    query: '',
    representation: 'category',
    type: 'nested',
  });
  const shared = useStoryTree(filesByOwner.shared, {
    query: '',
    representation: 'category',
    type: 'nested',
  });

  return {
    foundations,
    principles,
    patterns,
    typography,
    layout,
    core,
    product,
    shared,
  };
}

const SidebarContainer = styled('nav')`
  position: fixed;
  top: 52px;
  grid-row: 1;
  grid-column: 1;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  min-height: 0;
  height: calc(100dvh - 52px);
  z-index: 0;
  box-shadow: 1px 0 0 0 ${p => p.theme.tokens.border.primary};
  width: 256px;
  background: ${p => p.theme.tokens.background.primary};
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: ${p => p.theme.tokens.border.primary}
    ${p => p.theme.tokens.background.primary};
  ul,
  li {
    list-style: none;
  }
  > ul {
    padding-left: ${p => p.theme.space.md};
    padding-block: ${p => p.theme.space.xl};
  }
  > ul > li::before {
    display: block;
    content: '';
    height: 1px;
    background: ${p => p.theme.tokens.border.muted};
    margin: ${p => p.theme.space.xl} ${p => p.theme.space.md};
  }
  > ul > li:first-child::before {
    content: none;
  }
  h3 {
    color: ${p => p.theme.tokens.content.primary};
    font-size: ${p => p.theme.fontSize.md};
    font-weight: ${p => p.theme.fontWeight.bold};
    margin: 0;
    padding: ${p => p.theme.space.md};
  }
`;
