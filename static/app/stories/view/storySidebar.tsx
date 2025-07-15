import {useMemo} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import type {StoryTreeNode} from './storyTree';
import {StoryTree, useStoryTree} from './storyTree';
import {useStoryBookFiles} from './useStoriesLoader';

export function StorySidebar() {
  const {foundations, core, shared} = useStoryBookFilesByCategory();

  return (
    <SidebarContainer>
      <ul>
        <li>
          <h3>Foundations</h3>
          <StoryTree nodes={foundations} />
        </li>
        <li>
          <h3>Core Components</h3>
          <StoryTree nodes={core} />
        </li>
        <li>
          <h3>Product Components</h3>
          <StoryTree nodes={shared} />
        </li>
      </ul>
    </SidebarContainer>
  );
}

export function useStoryBookFilesByCategory(): Record<
  'foundations' | 'core' | 'shared',
  StoryTreeNode[]
> {
  const files = useStoryBookFiles();
  const filesByOwner = useMemo(() => {
    // The order of keys here is important and used by the pagination in storyFooter
    const map: Record<'foundations' | 'core' | 'shared', string[]> = {
      foundations: [],
      core: [],
      shared: [],
    };
    for (const file of files) {
      if (isFoundationFile(file)) {
        map.foundations.push(file);
      } else if (isCoreFile(file)) {
        map.core.push(file);
      } else {
        map.shared.push(file);
      }
    }
    return map;
  }, [files]);

  const foundations = useStoryTree(filesByOwner.foundations, {
    query: '',
    representation: 'category',
  });
  const core = useStoryTree(filesByOwner.core, {
    query: '',
    representation: 'category',
    type: 'flat',
  });
  const shared = useStoryTree(filesByOwner.shared, {
    query: '',
    representation: 'category',
  });

  return {
    foundations,
    core,
    shared,
  };
}

function isCoreFile(file: string) {
  return file.includes('components/core');
}

function isFoundationFile(file: string) {
  return file.includes('app/styles') || file.includes('app/icons');
}

const SidebarContainer = styled('nav')`
  position: fixed;
  top: 52px;
  grid-row: 1;
  grid-column: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  min-height: 0;
  height: calc(100dvh - 52px);
  z-index: 0;
  box-shadow: 1px 0 0 0 ${p => p.theme.tokens.border.primary};
  width: 256px;
  background: ${p => p.theme.tokens.background.primary};
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: ${p => p.theme.tokens.border.primary} ${p => p.theme.background};
  ul,
  li {
    list-style: none;
  }
  > ul {
    padding-left: ${space(1)};
    padding-block: ${space(2)};
  }
  > ul > li::before {
    display: block;
    content: '';
    height: 1px;
    background: ${p => p.theme.tokens.border.muted};
    margin: ${space(2)} ${space(1)};
  }
  > ul > li:first-child::before {
    content: none;
  }
  h3 {
    color: ${p => p.theme.tokens.content.primary};
    font-size: ${p => p.theme.fontSize.md};
    font-weight: ${p => p.theme.fontWeight.bold};
    margin: 0;
    padding: ${space(1)};
  }
`;
