import {Fragment, type PropsWithChildren} from 'react';
import {css, Global, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  StorySidebar,
  useStoryBookFilesByCategory,
} from 'sentry/stories/view/storySidebar';
import {StoryTreeNode, type StoryCategory} from 'sentry/stories/view/storyTree';
import {useLocation} from 'sentry/utils/useLocation';
import {OrganizationContainer} from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

import {StoryLanding} from './landing';
import {StoryExports} from './storyExports';
import {StoryHeader} from './storyHeader';
import {useStoryDarkModeTheme} from './useStoriesDarkMode';
import {useStoriesLoader} from './useStoriesLoader';

export function useStoryParams(): {storyCategory?: StoryCategory; storySlug?: string} {
  const location = useLocation();
  // Match: /stories/:category/(one/optional/or/more/path/segments)
  // Handles both /stories/... and /organizations/{org}/stories/...
  // Supports optional trailing slashes
  const match = location.pathname.match(/\/stories\/([^/]+)\/(.+?)\/?$/);
  return {
    storyCategory: match?.[1] as StoryCategory | undefined,
    storySlug: match?.[2] ?? undefined,
  };
}

export default function Stories() {
  const location = useLocation();
  return isLandingPage(location) && !location.query.name ? (
    <StoriesLanding />
  ) : (
    <StoryDetail />
  );
}

function StoriesLanding() {
  return (
    <StoriesLayout>
      <StoryMainContainer>
        <StoryLanding />
      </StoryMainContainer>
    </StoriesLayout>
  );
}

function StoryDetail() {
  const location = useLocation();
  const {storyCategory, storySlug} = useStoryParams();
  const stories = useStoryBookFilesByCategory();

  let storyNode = getStoryFromParams(stories, {
    category: storyCategory,
    slug: storySlug,
  });

  // If we don't have a story node, try to find it by the filesystem path
  if (!storyNode && location.query.name) {
    const nodes = Object.values(stories).flat();
    const queue = [...nodes];

    while (queue.length > 0) {
      const node = queue.pop();
      if (!node) break;

      if (node.filesystemPath === location.query.name) {
        storyNode = node;
        break;
      }

      for (const key in node.children) {
        queue.push(node.children[key]!);
      }
    }
  }

  const story = useStoriesLoader({
    files: storyNode ? [storyNode.filesystemPath] : [],
  });

  return (
    <StoriesLayout>
      {story.isLoading ? (
        <VerticalScroll>
          <LoadingIndicator />
        </VerticalScroll>
      ) : story.isError ? (
        <VerticalScroll>
          <Alert.Container>
            <Alert type="error">
              <strong>{story.error.name}:</strong> {story.error.message}
            </Alert>
          </Alert.Container>
        </VerticalScroll>
      ) : story.isSuccess ? (
        <StoryMainContainer>
          {story.data.map(s => {
            return <StoryExports key={s.filename} story={s} />;
          })}
        </StoryMainContainer>
      ) : (
        <VerticalScroll>
          <strong>The file you selected does not export a story.</strong>
        </VerticalScroll>
      )}
    </StoriesLayout>
  );
}

function StoriesLayout(props: PropsWithChildren) {
  return (
    <Fragment>
      <GlobalStoryStyles key="global-story-styles" />
      <RouteAnalyticsContextProvider>
        <OrganizationContainer>
          <Layout>
            <HeaderContainer>
              <StoryHeader />
            </HeaderContainer>
            <StorySidebar />
            {props.children}
          </Layout>
        </OrganizationContainer>
      </RouteAnalyticsContextProvider>
    </Fragment>
  );
}

function isLandingPage(location: ReturnType<typeof useLocation>) {
  // Handles both /stories and /organizations/{org}/stories
  return /\/stories\/?$/.test(location.pathname);
}

function getStoryFromParams(
  stories: ReturnType<typeof useStoryBookFilesByCategory>,
  context: {category?: StoryCategory; slug?: string}
): StoryTreeNode | undefined {
  const nodes = stories[context.category as keyof typeof stories] ?? [];

  if (!nodes || nodes.length === 0) {
    return undefined;
  }

  const queue = [...nodes];

  while (queue.length > 0) {
    const node = queue.pop();
    if (!node) break;

    if (node.slug === context.slug) {
      return node;
    }

    for (const key in node.children) {
      queue.push(node.children[key]!);
    }
  }

  return undefined;
}

function GlobalStoryStyles() {
  const theme = useTheme();
  const darkTheme = useStoryDarkModeTheme();
  const location = useLocation();
  const isIndex = isLandingPage(location);
  const styles = css`
    /* match body background with header story styles */
    body {
      background-color: ${isIndex
        ? darkTheme.tokens.background.secondary
        : theme.tokens.background.secondary};
    }
    /* fixed position color block to match overscroll color to story background */
    body::after {
      content: '';
      display: block;
      position: fixed;
      inset: 0;
      top: unset;
      background-color: ${theme.tokens.background.primary};
      height: 50vh;
      z-index: -1;
      pointer-events: none;
    }
    /* adjust position of global .messages-container element */
    .messages-container {
      margin-top: 52px;
      margin-left: 256px;
      z-index: ${theme.zIndex.header};
      background: ${theme.tokens.background.primary};
    }
  `;
  return <Global styles={styles} />;
}

const Layout = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  --stories-grid-space: 0;

  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: 256px minmax(auto, 1fr);
  place-items: stretch;
  min-height: calc(100dvh - 52px);
  padding-bottom: ${p => p.theme.space['3xl']};
  position: absolute;
  top: 52px;
  left: 0;
  right: 0;
`;

const HeaderContainer = styled('header')`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: ${p => p.theme.zIndex.header};
  background: ${p => p.theme.tokens.background.primary};
`;

const VerticalScroll = styled('main')`
  overflow-x: visible;
  overflow-y: auto;

  grid-row: 1;
  grid-column: 2;
  padding: ${p => p.theme.space.xl};
`;

const StoryMainContainer = styled('main')`
  grid-row: 1;
  grid-column: 2;
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    scroll-margin-top: 80px;
    margin: 0;
  }

  p,
  pre {
    margin: 0;
  }

  code:not([class]):not(pre > code) {
    background: ${p => p.theme.tokens.background.secondary};
    color: ${p => p.theme.tokens.content.primary};
  }

  table:not([class]) {
    margin: 1px;
    padding: 0;
    width: calc(100% - 2px);
    table-layout: auto;
    border: 0;
    border-collapse: collapse;
    border-radius: ${p => p.theme.radius.md};
    box-shadow: 0 0 0 1px ${p => p.theme.tokens.border.primary};
    margin-bottom: ${p => p.theme.space['3xl']};

    & thead {
      height: 36px;
      border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
      background: ${p => p.theme.tokens.background.tertiary};
      border-bottom: 4px solid ${p => p.theme.tokens.border.primary};
    }

    & th {
      padding-inline: ${p => p.theme.space.xl};
      padding-block: ${p => p.theme.space.sm};

      &:first-of-type {
        border-radius: ${p => p.theme.radius.md} 0 0 0;
      }
      &:last-of-type {
        border-radius: 0 ${p => p.theme.radius.md} 0 0;
      }
    }

    tr:last-child td:first-of-type {
      border-radius: 0 0 0 ${p => p.theme.radius.md};
    }
    tr:last-child td:last-of-type {
      border-radius: 0 0 ${p => p.theme.radius.md} 0;
    }

    tbody {
      background: ${p => p.theme.tokens.background.primary};
      border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
    }

    tr {
      border-bottom: 1px solid ${p => p.theme.tokens.border.muted};
      vertical-align: baseline;

      &:last-child {
        border-bottom: 0;
      }
    }

    td:first-child {
      white-space: nowrap;
      word-break: break-all;
      hyphens: none;
    }

    td {
      padding-inline: ${p => p.theme.space.xl};
      padding-block: ${p => p.theme.space.lg};
    }
  }

  div + .expressive-code .frame {
    border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
    pre {
      border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
    }
  }

  .expressive-code .frame {
    margin-bottom: ${p => p.theme.space['3xl']};
    box-shadow: none;
    border: 1px solid #000000;
    pre {
      background: hsla(254, 18%, 15%, 1);
      border: 0;
    }
  }
`;
