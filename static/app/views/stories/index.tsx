import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {FilesList} from 'sentry/constants/ui-stories-list';
import {space} from 'sentry/styles/space';
import EmptyStory from 'sentry/views/stories/emptyStory';
import StoryFile from 'sentry/views/stories/storyFile';
import StoryHeader from 'sentry/views/stories/storyHeader';
import StoryList from 'sentry/views/stories/storyList';
import type {StoriesQuery} from 'sentry/views/stories/types';

type Props = RouteComponentProps<{}, {}, any, StoriesQuery>;

export default function Stories({
  location: {
    query: {name: currentFile},
  },
}: Props) {
  return (
    <Layout>
      <StoryHeader style={{gridArea: 'head'}} />
      <StoryList style={{gridArea: 'list'}} files={FilesList} />
      <StyledPanel style={{gridArea: 'body'}}>
        {currentFile ? <StoryFile filename={currentFile} /> : <EmptyStory />}
      </StyledPanel>
    </Layout>
  );
}

const Layout = styled('div')`
  --stories-grid-space: ${space(1)};

  display: grid;
  grid-template:
    'head head' max-content
    'list body' auto/minmax(300px, max-content) 1fr;
  gap: var(--stories-grid-space);
  place-items: stretch;

  height: 100vh;
  padding: var(--stories-grid-space);
`;

const StyledPanel = styled(Panel)`
  margin: 0;
  padding: var(--stories-grid-space);

  /* TODO: See about this */
  /* display: flex; */
  /* overflow: auto; */
`;
