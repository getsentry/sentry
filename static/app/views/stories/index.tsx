import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {Alert} from 'sentry/components/core/alert/alert';
import {InputGroup} from 'sentry/components/inputGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSettings} from 'sentry/icons';
import {IconSearch} from 'sentry/icons/iconSearch';
import {space} from 'sentry/styles/space';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';
import {StoryExports} from 'sentry/views/stories/storyExports';
import {StoryHeader} from 'sentry/views/stories/storyHeader';
import {StoryTableOfContents} from 'sentry/views/stories/storyTableOfContents';
import {StoryTree, useStoryTree} from 'sentry/views/stories/storyTree';
import {useStoriesLoader, useStoryBookFiles} from 'sentry/views/stories/useStoriesLoader';

import {useLocalStorageState} from '../../utils/useLocalStorageState';

export default function Stories() {
  const searchInput = useRef<HTMLInputElement>(null);
  const location = useLocation<{name: string; query?: string}>();
  const files = useStoryBookFiles();

  // If no story is selected, show the landing page stories
  const storyFiles = useMemo(() => {
    if (!location.query.name) {
      return files.filter(
        file =>
          file.endsWith('styles/colors.stories.tsx') ||
          file.endsWith('styles/typography.stories.tsx')
      );
    }
    return [location.query.name];
  }, [files, location.query.name]);

  const story = useStoriesLoader({files: storyFiles});
  const [storyRepresentation, setStoryRepresentation] = useLocalStorageState<
    'category' | 'filesystem'
  >('story-representation', 'category');

  const nodes = useStoryTree(files, {
    query: location.query.query ?? '',
    representation: storyRepresentation,
  });

  const navigate = useNavigate();
  const onSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      navigate({
        query: {...location.query, query: e.target.value, name: location.query.name},
      });
    },
    [location.query, navigate]
  );

  const storiesSearchHotkeys = useMemo(() => {
    return [{match: '/', callback: () => searchInput.current?.focus()}];
  }, []);
  useHotkeys(storiesSearchHotkeys);

  return (
    <RouteAnalyticsContextProvider>
      <OrganizationContainer>
        <Layout>
          <HeaderContainer>
            <StoryHeader />
          </HeaderContainer>

          <SidebarContainer>
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
              <InputGroup.TrailingItems>
                <StoryRepresentationToggle
                  storyRepresentation={storyRepresentation}
                  setStoryRepresentation={setStoryRepresentation}
                />
              </InputGroup.TrailingItems>
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
              <Alert.Container>
                <Alert type="error" showIcon>
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
          <StoryIndexContainer>
            <StoryTableOfContents />
          </StoryIndexContainer>
        </Layout>
      </OrganizationContainer>
    </RouteAnalyticsContextProvider>
  );
}

function StoryRepresentationToggle(props: {
  setStoryRepresentation: (value: 'category' | 'filesystem') => void;
  storyRepresentation: 'category' | 'filesystem';
}) {
  return (
    <CompactSelect
      trigger={triggerProps => (
        <Button
          borderless
          icon={<IconSettings />}
          size="xs"
          aria-label="Toggle story representation"
          {...triggerProps}
        />
      )}
      defaultValue={props.storyRepresentation}
      options={[
        {label: 'Filesystem', value: 'filesystem'},
        {label: 'Category', value: 'category'},
      ]}
      onChange={option => props.setStoryRepresentation(option.value)}
    />
  );
}

const Layout = styled('div')`
  --stories-grid-space: ${space(2)};

  display: grid;
  grid-template:
    'head head head' max-content
    'aside body index' auto / 200px 1fr;
  gap: var(--stories-grid-space);
  place-items: stretch;

  height: 100vh;
  padding: var(--stories-grid-space);
`;

const HeaderContainer = styled('div')`
  grid-area: head;
`;

const SidebarContainer = styled('div')`
  grid-area: aside;
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  min-height: 0;
  position: relative;
  z-index: 10;
`;

const StoryTreeContainer = styled('div')`
  overflow-y: scroll;
  flex-grow: 1;
`;

const StoryIndexContainer = styled('div')`
  grid-area: index;
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
const StoryMainContainer = styled(VerticalScroll)`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};

  grid-area: body;

  padding: var(--stories-grid-space);
  padding-top: 0;
  overflow-x: hidden;
  overflow-y: auto;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    scroll-margin-top: ${space(3)};
  }
`;
