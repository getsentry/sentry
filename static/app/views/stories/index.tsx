import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
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

  return (
    <Layout>
      <StoryHeader style={{gridArea: 'head'}} />
      <aside style={{gridArea: 'aside'}}>
        <StoryTree files={storiesContext().files()} />
      </aside>

      {story.error ? (
        <VerticalScroll style={{gridArea: 'body'}}>
          <ErrorStory error={story.error} />
        </VerticalScroll>
      ) : story.resolved ? (
        <Main style={{gridArea: 'body'}}>
          <StoryFile filename={story.filename} resolved={story.resolved} />
        </Main>
      ) : (
        <VerticalScroll style={{gridArea: 'body'}}>
          <EmptyStory />
        </VerticalScroll>
      )}
    </Layout>
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
  overflow-y: scroll;

  position: relative;
`;
