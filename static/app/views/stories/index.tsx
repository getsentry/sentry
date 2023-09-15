import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {FilesList} from 'sentry/constants/generated-ui-stories-list';
import {space} from 'sentry/styles/space';
import EmptyStory from 'sentry/views/stories/emptyStory';
import ErrorStory from 'sentry/views/stories/errorStory';
import StoryFile from 'sentry/views/stories/storyFile';
import StoryHeader from 'sentry/views/stories/storyHeader';
import StoryList from 'sentry/views/stories/storyList';
import type {StoriesQuery} from 'sentry/views/stories/types';
import useStoriesLoader from 'sentry/views/stories/useStoriesLoader';

type Props = RouteComponentProps<{}, {}, any, StoriesQuery>;

export default function Stories({
  location: {
    query: {name: filename},
  },
}: Props) {
  const story = useStoriesLoader({filename});

  return (
    <Layout>
      <StoryHeader style={{gridArea: 'head'}} />
      <StoryList style={{gridArea: 'list'}} files={FilesList} />

      {story.error ? (
        <MessageContainer style={{gridArea: 'body'}}>
          <ErrorStory error={story.error} />
        </MessageContainer>
      ) : story.resolved ? (
        <StyledPanel style={{gridArea: 'body'}}>
          <StoryFile filename={story.filename} resolved={story.resolved} />
        </StyledPanel>
      ) : (
        <MessageContainer style={{gridArea: 'body'}}>
          <EmptyStory />
        </MessageContainer>
      )}
    </Layout>
  );
}

const Layout = styled('div')`
  --stories-grid-space: ${space(2)};

  display: grid;
  grid-template:
    'head head' max-content
    'list body' auto/minmax(300px, max-content) 1fr;
  gap: var(--stories-grid-space);
  place-items: stretch;

  height: 100vh;
  padding: var(--stories-grid-space);
`;

const MessageContainer = styled('div')`
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: scroll;
`;

const StyledPanel = styled(Panel)`
  margin: 0;
  padding: var(--stories-grid-space);
  overflow-x: hidden;
  overflow-y: scroll;

  /* TODO: See about this */
  /* display: flex; */
  /* overflow: auto; */
`;
