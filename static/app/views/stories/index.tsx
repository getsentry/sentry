import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/inputGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons/iconSearch';
import {space} from 'sentry/styles/space';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  const files = useMemo(() => storiesContext().files(), []);
  const nodes = useStoryTree(location.query.query ?? '', files);

  const navigate = useNavigate();
  const onSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      navigate({query: {query: e.target.value, name: location.query.name}});
    },
    [location.query.name, navigate]
  );

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
                placeholder="Search stories"
                defaultValue={location.query.query ?? ''}
                onChange={onSearchInputChange}
              />
              {/* @TODO (JonasBadalic): Implement clear button when there is an active query */}
            </InputGroup>
            <StoryTreeContainer>
              <StoryTree nodes={nodes} />
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

function useStoryTree(query: string, files: string[]) {
  const location = useLocation();
  const initialName = useRef(location.query.name);

  const tree = useMemo(() => {
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

    // If the user navigates to a story, expand to its location in the tree
    if (initialName.current) {
      for (const {node, path} of root.files()) {
        if (node.path === initialName.current) {
          for (const p of path) {
            p.expanded = true;
          }
          initialName.current = null;
          break;
        }
      }
    }

    return root;
  }, [files]);

  const nodes = useMemo(() => {
    // Skip the top level app folder as it's where the entire project is at
    const root = tree.find(node => node.name === 'app') ?? tree;

    if (!query) {
      if (initialName.current) {
        return Object.values(root.children);
      }

      // If there is no initial query and no story is selected, the sidebar
      // tree is collapsed to the root node.
      for (const node of root) {
        node.visible = true;
        node.expanded = false;
      }
      return Object.values(root.children);
    }

    for (const node of root) {
      node.visible = false;
      node.expanded = false;
      node.result = null;
    }

    // Fzf requires the input to be lowercase as it normalizes the search candidates to lowercase
    const lowerCaseQuery = query.toLowerCase();

    for (const {node, path} of root.files()) {
      const match = fzf(node.name, lowerCaseQuery, false);
      node.visible = match.score > 0;
      node.result = match;

      if (node.visible) {
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

    return Object.values(root.children);
  }, [tree, query]);

  return nodes;
}

export class StoryTreeNode {
  expanded = false;
  visible = true;
  result: ReturnType<typeof fzf> | null = null;
  children: Record<string, StoryTreeNode> = {};

  constructor(
    public name: string,
    public path: string
  ) {}

  find(predicate: (node: StoryTreeNode) => boolean): StoryTreeNode | undefined {
    for (const node of this) {
      if (node && predicate(node)) {
        return node;
      }
    }
    return undefined;
  }

  // Iterator that yields all files in the tree, excluding folders
  *files(): Generator<{node: StoryTreeNode; path: StoryTreeNode[]}> {
    function* recurse(node: StoryTreeNode, path: StoryTreeNode[]) {
      if (Object.keys(node.children).length === 0) {
        yield {node, path};
      }

      for (const child of Object.values(node.children)) {
        yield* recurse(child, [...path, node]);
      }

      return;
    }

    yield* recurse(this, []);
  }

  // Iterator that yields all nodes in the tree
  *[Symbol.iterator](): Generator<StoryTreeNode> {
    const queue: StoryTreeNode[] = [this];

    while (queue.length > 0) {
      const node = queue.pop();
      if (node) {
        yield node
      }

      const nodeChildren = Object.values(node?.children ?? {});
      for (let i = nodeChildren.length - 1; i >= 0; i--) {
        queue.push(nodeChildren[i]!);
      }
    }
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
