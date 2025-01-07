import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import Input from 'sentry/components/input';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';
import EmptyStory from 'sentry/views/stories/emptyStory';
import ErrorStory from 'sentry/views/stories/errorStory';
import storiesContext from 'sentry/views/stories/storiesContext';
import StoryFile from 'sentry/views/stories/storyFile';
import StoryHeader from 'sentry/views/stories/storyHeader';
import StoryTree from 'sentry/views/stories/storyTree';
import type {StoriesQuery} from 'sentry/views/stories/types';
import useStoriesLoader from 'sentry/views/stories/useStoriesLoader';

type Props = RouteComponentProps<{}, {}, any, StoriesQuery>;

export default function Stories({location}: Props) {
  const story = useStoriesLoader({filename: location.query.name});
  const [searchTerm, setSearchTerm] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);

  useHotkeys([{match: '/', callback: () => searchInput.current?.focus()}], []);

  return (
    <RouteAnalyticsContextProvider>
      <OrganizationContainer>
        <Layout>
          <StoryHeader style={{gridArea: 'head'}} />

          <Sidebar style={{gridArea: 'aside'}}>
            <Input
              ref={searchInput}
              placeholder="Search files by name"
              onChange={e => setSearchTerm(e.target.value.toLowerCase())}
            />
            <TreeContainer>
              <StoryTree
                files={storiesContext()
                  .files()
                  .filter(s => s.toLowerCase().includes(searchTerm))}
              />
            </TreeContainer>
          </Sidebar>

          {story.isError ? (
            <VerticalScroll style={{gridArea: 'body'}}>
              <ErrorStory error={story.error} />
            </VerticalScroll>
          ) : story.isSuccess ? (
            <Main style={{gridArea: 'body'}}>
              <StoryFile filename={story.data.filename} resolved={story.data.resolved} />
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

const Sidebar = styled('aside')`
  display: flex;
  gap: ${space(2)};
  flex-direction: column;
  min-height: 0;
`;

const TreeContainer = styled('div')`
  overflow: scroll;
  flex-grow: 1;
`;

const VerticalScroll = styled('main')`
  overflow-x: hidden;
  overflow-y: scroll;
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
