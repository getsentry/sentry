import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/inputGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons/iconSearch';
import {space} from 'sentry/styles/space';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';
import EmptyStory from 'sentry/views/stories/emptyStory';
import ErrorStory from 'sentry/views/stories/errorStory';
import storiesContext from 'sentry/views/stories/storiesContext';
import StoryFile from 'sentry/views/stories/storyFile';
import StoryHeader from 'sentry/views/stories/storyHeader';
import StoryTree from 'sentry/views/stories/storyTree';
import useStoriesLoader from 'sentry/views/stories/useStoriesLoader';

export default function Stories() {
  const searchInput = useRef<HTMLInputElement>(null);
  const location = useLocation<{name: string; query?: string}>();
  const story = useStoriesLoader({filename: location.query.name});

  const tree = useMemo(() => {
    const files = storiesContext().files();
    const root = new StoryTreeNode('root', '');

    for (const file of files) {
      const parts = file.split('/');
      let parent = root;

      for (const part of parts) {
        if (!(part in parent.children)) {
          parent.children[part] = new StoryTreeNode(part, file);
        }

        parent = parent.children[part]!;
      }
    }

    // Skip the top level app folder as it's where the entire project is at
    return root.find(node => node.name === 'app') ?? root;
  }, []);

  useHotkeys([{match: '/', callback: () => searchInput.current?.focus()}], []);

  return (
    <RouteAnalyticsContextProvider>
      <OrganizationContainer>
        <Layout>
          <StoryHeader style={{gridArea: 'head'}} />

          <SidebarContainer style={{gridArea: 'aside'}}>
            <InputGroup>
              <InputGroup.LeadingItems disablePointerEvents>
                <IconSearch />
              </InputGroup.LeadingItems>
              <InputGroup.Input
                ref={searchInput}
                placeholder="Search files by name"
                defaultValue={location.query.query ?? ''}
                onChange={e => {
                  const _value = e.target.value;
                  void _value;
                }}
              />
            </InputGroup>
            <StoryTreeContainer>
              <StoryTree nodes={Object.values(tree.children)} />
            </StoryTreeContainer>
          </SidebarContainer>

          {story.isLoading ? (
            <VerticalScroll style={{gridArea: 'body'}}>
              <LoadingIndicator />
            </VerticalScroll>
          ) : story.isError ? (
            <VerticalScroll style={{gridArea: 'body'}}>
              <ErrorStory error={story.error} />
            </VerticalScroll>
          ) : story.isSuccess ? (
            // @TODO (JonasBadalic): check that a story actually has exports, else it could still be empty
            <Main style={{gridArea: 'body'}}>
              <StoryFile story={story.data} />
            </Main>
          ) : (
            <VerticalScroll style={{gridArea: 'body'}}>
              <EmptyStory />
            </VerticalScroll>
          )}
        </Layout>
      </OrganizationContainer>
    </RouteAnalyticsContextProvider>
  );
}

export class StoryTreeNode {
  expanded = false;
  children: Record<string, StoryTreeNode> = {};

  constructor(
    public name: string,
    public path: string
  ) {}

  // Bfs over the tree to find the node by name
  find(predicate: (node: StoryTreeNode) => boolean): StoryTreeNode | undefined {
    const queue: StoryTreeNode[] = [];

    const children = Object.values(this.children);
    for (let i = children.length - 1; i >= 0; i--) {
      queue.push(children[i]!);
    }

    while (queue.length > 0) {
      const node = queue.pop();
      if (node && predicate(node)) {
        return node;
      }

      const nodeChildren = Object.values(node?.children ?? {});
      for (let i = nodeChildren.length - 1; i >= 0; i--) {
        queue.push(nodeChildren[i]!);
      }
    }

    return undefined;
  }
}

const Layout = styled('div')`
  --stories-grid-space: ${space(2)};

  display: grid;
  grid-template:
    'head head' max-content
    'aside body' auto/ ${p => p.theme.settings.sidebarWidth} 1fr;
  gap: var(--stories-grid-space);
  place-items: stretch;

  height: 100vh;
  padding: var(--stories-grid-space);
`;

const SidebarContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  min-height: 0;
`;

const StoryTreeContainer = styled('div')`
  overflow-y: scroll;
  flex-grow: 1;
`;

const VerticalScroll = styled('main')`
  overflow-x: hidden;
  overflow-y: scroll;
  grid-area: body;
`;

/**
 * Avoid <Panel> here because nested panels will have a modified theme.
 * Therefore stories will look different in prod.
 */
const Main = styled(VerticalScroll)`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.panelBorderRadius};
  border: 1px solid ${p => p.theme.border};

  padding: var(--stories-grid-space);
  overflow-x: hidden;
  overflow-y: auto;

  position: relative;
`;
