import {useMemo} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import {StoryTree, useStoryTree} from './storyTree';
import {useStoryBookFiles} from './useStoriesLoader';

export function StorySidebar() {
  const files = useStoryBookFiles();
  const filesByOwner = useMemo(() => {
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

  const foundationsTree = useStoryTree(filesByOwner.foundations, {
    query: '',
    representation: 'category',
  });
  const coreTree = useStoryTree(filesByOwner.core, {
    query: '',
    representation: 'category',
    type: 'flat',
  });
  const sharedTree = useStoryTree(filesByOwner.shared, {
    query: '',
    representation: 'category',
  });

  return (
    <SidebarContainer>
      <ul>
        <li>
          <h3>Foundations</h3>
          <StoryTree nodes={foundationsTree} />
        </li>
        <li>
          <h3>Components</h3>
          <StoryTree nodes={coreTree} />
        </li>
        <li>
          <h3>Shared</h3>
          <StoryTree nodes={sharedTree} />
        </li>
      </ul>
    </SidebarContainer>
  );
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
    font-weight: ${p => p.theme.fontWeightBold};
    margin: 0;
    padding: ${space(1)};
  }
`;
