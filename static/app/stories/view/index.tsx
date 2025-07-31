import {Fragment, type PropsWithChildren, useEffect} from 'react';
import {css, Global, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {StorySidebar} from 'sentry/stories/view/storySidebar';
import {useStoryRedirect} from 'sentry/stories/view/useStoryRedirect';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

import {StoryLanding} from './landing';
import {StoryExports} from './storyExports';
import {StoryHeader} from './storyHeader';
import {useStoryDarkModeTheme} from './useStoriesDarkMode';
import {useStoriesLoader} from './useStoriesLoader';

export default function Stories() {
  const location = useLocation();
  return isLandingPage(location) ? <StoriesLanding /> : <StoryDetail />;
}

function isLandingPage(location: ReturnType<typeof useLocation>) {
  return /\/stories\/?$/.test(location.pathname) && !location.query.name;
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
  useStoryRedirect();
  useScrollToHash();
  const location = useLocation<{name: string; query?: string}>();
  const files = [location.state?.storyPath ?? location.query.name];
  const story = useStoriesLoader({files});

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

function scrollToHash() {
  if (window.location.hash) {
    const hash = window.location.hash.replace(/^#/, '');

    try {
      const element = document.querySelector(`#${hash}`);
      if (element) {
        element.scrollIntoView({behavior: 'instant', block: 'start'});
        return true; // Successfully scrolled
      }
      return false; // Element not found
    } catch {
      // hash might be an invalid querySelector and lead to a DOMException
      return false;
    }
  }
  return true; // No hash to scroll to
}

function useScrollToHash() {
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    let attempts = 0;
    const maxAttempts = 20; // Maximum number of attempts
    const baseDelay = 50; // Base delay in ms
    const maxDelay = 2000; // Maximum delay in ms

    const tryScroll = () => {
      if (scrollToHash()) {
        return; // Successfully scrolled or no hash
      }

      attempts++;
      if (attempts >= maxAttempts) {
        return; // Give up after max attempts
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelay * Math.pow(1.5, attempts), maxDelay);
      const jitter = Math.random() * 0.1 * delay; // Add up to 10% jitter

      timers.push(setTimeout(tryScroll, delay + jitter));
    };

    // Start with a small initial delay to allow initial render
    requestAnimationFrame(() => {
      timers.push(setTimeout(tryScroll, 100));
    });
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, []);
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
  padding-bottom: ${space(4)};
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
  padding: ${space(2)};
`;

const StoryMainContainer = styled('div')`
  grid-row: 1;
  grid-column: 2;
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};

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

  code:not(pre > code) {
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
    border-radius: ${p => p.theme.borderRadius};
    box-shadow: 0 0 0 1px ${p => p.theme.tokens.border.primary};
    margin-bottom: 32px;

    & thead {
      height: 36px;
      border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
      background: ${p => p.theme.tokens.background.tertiary};
      border-bottom: 4px solid ${p => p.theme.tokens.border.primary};
    }

    & th {
      padding-inline: ${space(2)};
      padding-block: ${space(0.75)};

      &:first-of-type {
        border-radius: ${p => p.theme.borderRadius} 0 0 0;
      }
      &:last-of-type {
        border-radius: 0 ${p => p.theme.borderRadius} 0 0;
      }
    }

    tr:last-child td:first-of-type {
      border-radius: 0 0 0 ${p => p.theme.borderRadius};
    }
    tr:last-child td:last-of-type {
      border-radius: 0 0 ${p => p.theme.borderRadius} 0;
    }

    tbody {
      background: ${p => p.theme.tokens.background.primary};
      border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
    }

    tr {
      border-bottom: 1px solid ${p => p.theme.tokens.border.muted};
      vertical-align: baseline;

      &:last-child {
        border-bottom: 0;
      }
    }

    td {
      padding-inline: ${space(2)};
      padding-block: ${space(1.5)};
    }
  }

  div + .expressive-code .frame {
    border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
    pre {
      border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
    }
  }

  .expressive-code .frame {
    margin-bottom: 32px;
    box-shadow: none;
    border: 1px solid #000000;
    pre {
      background: hsla(254, 18%, 15%, 1);
      border: 0;
    }
  }
`;
