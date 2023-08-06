import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {FilesList} from 'sentry/constants/ui-stories-list';
import {space} from 'sentry/styles/space';
import EmptyStory from 'sentry/views/stories/emptyStory';
import StoryFile from 'sentry/views/stories/storyFile';
import StoryHeader from 'sentry/views/stories/storyHeader';
import StoryList from 'sentry/views/stories/storyList';

type Query = {name: string};
type Props = RouteComponentProps<{}, {}, any, Query>;

export default function Stories({
  location: {
    query: {name: currentFile},
  },
}: Props) {
  return (
    <Layout>
      <StoryHeader style={{gridArea: 'head'}} />
      <StoryList style={{gridArea: 'list'}} files={FilesList} />
      {currentFile ? (
        <StoryFile style={{gridArea: 'body'}} filename={currentFile} />
      ) : (
        <EmptyStory style={{gridArea: 'body'}} />
      )}
    </Layout>
  );
}

const Layout = styled('div')`
  display: grid;
  grid-template:
    'head head' 40px
    'list body' auto/minmax(300px, max-content) 1fr;
  gap: ${space(2)};

  height: 100vh;
  padding: ${space(2)};
`;
