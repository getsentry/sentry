import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {StorySidebar} from 'sentry/stories/view/storySidebar';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

import {StoryExports} from './storyExports';
import {StoryHeader} from './storyHeader';
import {useStoriesLoader, useStoryBookFiles} from './useStoriesLoader';

export default function Stories() {
  const location = useLocation<{name: string; query?: string}>();
  const files = useStoryBookFiles();

  // If no story is selected, show the landing page stories
  const storyFiles = useMemo(() => {
    if (!location.query.name) {
      return files.filter(
        file =>
          file.endsWith('styles/colors.mdx') ||
          file.endsWith('styles/typography.stories.tsx')
      );
    }
    return [location.query.name];
  }, [files, location.query.name]);

  const story = useStoriesLoader({files: storyFiles});

  return (
    <RouteAnalyticsContextProvider>
      <OrganizationContainer>
        <Layout>
          <HeaderContainer>
            <StoryHeader />
          </HeaderContainer>

          <StorySidebar />

          {story.isLoading ? (
            <VerticalScroll style={{gridArea: 'body'}}>
              <LoadingIndicator />
            </VerticalScroll>
          ) : story.isError ? (
            <VerticalScroll style={{gridArea: 'body'}}>
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
            <VerticalScroll style={{gridArea: 'body'}}>
              <strong>The file you selected does not export a story.</strong>
            </VerticalScroll>
          )}
        </Layout>
      </OrganizationContainer>
    </RouteAnalyticsContextProvider>
  );
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
    scroll-margin-top: 64px;
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
