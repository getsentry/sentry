import {Fragment, type PropsWithChildren} from 'react';
import {css, Global, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Grid} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {StorySidebar} from 'sentry/stories/view/storySidebar';
import {useStoryRedirect} from 'sentry/stories/view/useStoryRedirect';
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

  const location = useLocation<{name: string; query?: string}>();
  const story = useStoriesLoader({
    files: [location.state?.storyPath ?? location.query.name],
  });

  return (
    <StoriesLayout>
      {story.isLoading ? (
        <main
          css={{
            overflowX: 'visible',
            overflowY: 'auto',
            gridRow: 1,
            gridColumn: 2,
            padding: 'var(--space-xl)',
          }}
        >
          <LoadingIndicator />
        </main>
      ) : story.isError ? (
        <main
          css={{
            overflowX: 'visible',
            overflowY: 'auto',
            gridRow: 1,
            gridColumn: 2,
            padding: 'var(--space-xl)',
          }}
        >
          <Alert.Container>
            <Alert type="error">
              <strong>{story.error.name}:</strong> {story.error.message}
            </Alert>
          </Alert.Container>
        </main>
      ) : story.isSuccess ? (
        <div
          css={{
            gridRow: 1,
            gridColumn: 2,
            color: 'var(--color-content-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-xl)',
            '& h1, h2, h3, h4, h5, h6': {
              scrollMarginTop: '80px',
              margin: 0,
            },
            '& p, pre': {
              margin: 0,
            },
            '& code:not(pre > code)': {
              background: 'var(--color-background-secondary)',
              color: 'var(--color-content-primary)',
            },
            '& table:not([class])': {
              margin: '1px',
              padding: 0,
              width: 'calc(100% - 2px)',
              tableLayout: 'auto',
              border: 0,
              borderCollapse: 'collapse',
              borderRadius: 'var(--border-radius)',
              boxShadow: '0 0 0 1px var(--color-border-primary)',
              marginBottom: 'var(--space-3xl)',
              '& thead': {
                height: '36px',
                borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
                background: 'var(--color-background-tertiary)',
                borderBottom: '4px solid var(--color-border-primary)',
              },
              '& th': {
                paddingInline: 'var(--space-xl)',
                paddingBlock: 'var(--space-sm)',
                '&:first-of-type': {
                  borderRadius: 'var(--border-radius) 0 0 0',
                },
                '&:last-of-type': {
                  borderRadius: '0 var(--border-radius) 0 0',
                },
              },
              '& tr:last-child td:first-of-type': {
                borderRadius: '0 0 0 var(--border-radius)',
              },
              '& tr:last-child td:last-of-type': {
                borderRadius: '0 0 var(--border-radius) 0',
              },
              '& tbody': {
                background: 'var(--color-background-primary)',
                borderRadius: '0 0 var(--border-radius) var(--border-radius)',
              },
              '& tr': {
                borderBottom: '1px solid var(--color-border-muted)',
                verticalAlign: 'baseline',
                '&:last-child': {
                  borderBottom: 0,
                },
              },
              '& td': {
                paddingInline: 'var(--space-xl)',
                paddingBlock: 'var(--space-lg)',
              },
            },
            '& div + .expressive-code .frame': {
              borderRadius: '0 0 var(--border-radius) var(--border-radius)',
              '& pre': {
                borderRadius: '0 0 var(--border-radius) var(--border-radius)',
              },
            },
            '& .expressive-code .frame': {
              marginBottom: 'var(--space-3xl)',
              boxShadow: 'none',
              border: '1px solid #000000',
              '& pre': {
                background: 'hsla(254, 18%, 15%, 1)',
                border: 0,
              },
            },
          }}
        >
          {story.data.map(s => {
            return <StoryExports key={s.filename} story={s} />;
          })}
        </div>
      ) : (
        <main
          css={{
            overflowX: 'visible',
            overflowY: 'auto',
            gridRow: 1,
            gridColumn: 2,
            padding: 'var(--space-xl)',
          }}
        >
          <strong>The file you selected does not export a story.</strong>
        </main>
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
          <Grid
            columns="256px minmax(auto, 1fr)"
            css={{
              background: 'var(--color-background-primary)',
              '--stories-grid-space': '0',
              gridTemplateRows: '1fr',
              placeItems: 'stretch',
              minHeight: 'calc(100dvh - 52px)',
              paddingBottom: 'var(--space-3xl)',
              position: 'absolute',
              top: '52px',
              left: 0,
              right: 0,
            }}
          >
            <header
              css={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 'var(--z-index-header)',
                background: 'var(--color-background-primary)',
              }}
            >
              <StoryHeader />
            </header>
            <StorySidebar />
            {props.children}
          </Grid>
        </OrganizationContainer>
      </RouteAnalyticsContextProvider>
    </Fragment>
  );
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
