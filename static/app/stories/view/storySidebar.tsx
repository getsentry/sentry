import styled from '@emotion/styled';

import {CategorizedStoryTree} from './storyTree';

export function StorySidebar() {
  return (
    <SidebarContainer key="sidebar" ref={scrollIntoView}>
      <CategorizedStoryTree />
    </SidebarContainer>
  );
}

function scrollIntoView(node: HTMLElement | null) {
  node
    ?.querySelector('[aria-current="page"]')
    ?.scrollIntoView({behavior: 'instant', block: 'nearest'});
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
    background: ${p => p.theme.tokens.border.secondary};
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
