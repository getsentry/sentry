import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Badge} from 'sentry/components/core/badge';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons/iconSearch';
import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import OrganizationContainer from 'sentry/views/organizationContainer';
import RouteAnalyticsContextProvider from 'sentry/views/routeAnalyticsContextProvider';

import {StoryExports} from './storyExports';
import {StoryHeader} from './storyHeader';
import {StoryTree, useStoryTree} from './storyTree';
import {useStoriesLoader, useStoryBookFiles} from './useStoriesLoader';

function isCoreFile(file: string) {
  return (
    file.includes('components/core') ||
    file.includes('app/styles') ||
    file.includes('app/icons')
  );
}

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

          <SidebarContainer>
            <ul>
              <li>Demo</li>
            </ul>
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
        </Layout>
      </OrganizationContainer>
    </RouteAnalyticsContextProvider>
  );
}

export function StorySearch() {
  const searchInput = useRef<HTMLInputElement>(null);
  const location = useLocation<{name: string; query?: string}>();
  const [showSearch] = useState(false);
  const files = useStoryBookFiles();
  const [storyRepresentation] = useLocalStorageState<'category' | 'filesystem'>(
    'story-representation',
    'category'
  );

  const query = location.query.query ?? '';
  const filesByOwner = useMemo(() => {
    const map: Record<'core' | 'shared', string[]> = {
      core: [],
      shared: [],
    };
    for (const file of files) {
      if (isCoreFile(file)) {
        map.core.push(file);
      } else {
        map.shared.push(file);
      }
    }
    return map;
  }, [files]);

  const coreTree = useStoryTree(filesByOwner.core, {
    query,
    representation: storyRepresentation,
  });
  const sharedTree = useStoryTree(filesByOwner.shared, {
    query,
    representation: storyRepresentation,
  });
  const navigate = useNavigate();
  const onSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      navigate(
        {
          query: {...location.query, query: e.target.value, name: location.query.name},
        },
        {replace: true}
      );
    },
    [location.query, navigate]
  );

  const storiesSearchHotkeys = useMemo(() => {
    return [{match: '/', callback: () => searchInput.current?.focus()}];
  }, []);
  useHotkeys(storiesSearchHotkeys);

  return (
    <Fragment>
      <InputGroup style={{minHeight: 33, height: 33, width: 256}}>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          ref={el => {
            searchInput.current = el;
            el?.addEventListener('focus', focus);
            return el?.removeEventListener('focus', focus);
          }}
          placeholder="Search stories"
          defaultValue={location.query.query ?? ''}
          onChange={onSearchInputChange}
        />
        <InputGroup.TrailingItems>
          <Badge type="internal">/</Badge>
        </InputGroup.TrailingItems>
        {/* @TODO (JonasBadalic): Implement clear button when there is an active query */}
      </InputGroup>
      {showSearch && (
        <StorySearchContainer>
          <StoryTreeTitle>Design System</StoryTreeTitle>
          <StoryTree nodes={coreTree} />
          <StoryTreeTitle>Shared</StoryTreeTitle>
          <StoryTree nodes={sharedTree} />
        </StorySearchContainer>
      )}
    </Fragment>
  );
}

const LegacyLayout = styled('div')`
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

const Layout = withChonk(
  LegacyLayout,
  chonkStyled('div')`
  background: ${p => p.theme.tokens.background.primary};
  --stories-grid-space: 0;

  display: grid;
  grid-template:
    'head head' 52px
    'aside body' auto / 200px 1fr;
  display: grid;
  grid-template-columns: 256px minmax(auto, 1fr);
  padding: 0 ${space(1)};
  place-items: stretch;

  min-height: 100vh;
  padding: var(--stories-grid-space);
`
);

const HeaderContainer = styled('header')`
  grid-area: head;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: calc(infinity);
  background: ${p => p.theme.tokens.background.primary};
`;

const SidebarContainer = styled('div')`
  grid-area: aside;
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  min-height: 0;
  z-index: 0;
  box-shadow: 1px 0 0 0 ${p => p.theme.tokens.border.primary};
  position: fixed;
  top: 52px;
`;

const StorySearchContainer = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-bottom-width: 3px;
  border-radius: ${p => p.theme.borderRadius};
  position: fixed;
  top: 48px;
  left: 272px;
  width: 320px;
  overflow-y: auto;
  flex-grow: 1;
  z-index: 999;
`;

const StoryTreeTitle = styled('p')`
  margin-bottom: ${space(1)};
`;

const VerticalScroll = styled('main')`
  overflow-x: visible;
  overflow-y: auto;
`;

/**
 * Avoid <Panel> here because nested panels will have a modified theme.
 * Therefore stories will look different in prod.
 */
const LegacyStoryMainContainer = styled(VerticalScroll)`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};

  display: contents;

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

const StoryMainContainer = withChonk(
  LegacyStoryMainContainer,
  chonkStyled('div')`
  grid-area: body;
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  h1, h2, h3, h4, h5, h6 {
    scroll-margin-top: ${p => p.theme.space['2xl']};
    margin: 0;
    text-box: trim-both cap alphabetic;
  }

  p, pre {
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
    border-radius: ${p => p.theme.radius.lg};
    box-shadow: 0 0 0 1px ${p => p.theme.tokens.border.primary};
    margin-bottom: 32px;

    & thead {
      height: 36px;
      border-radius: ${p => p.theme.radius.lg} ${p => p.theme.radius.lg} 0 0;
      background: ${p => p.theme.tokens.background.tertiary};
      border-bottom: 4px solid ${p => p.theme.tokens.border.primary};
    }

    & th {
      padding-inline: ${p => p.theme.space.xl};
      padding-block: ${p => p.theme.space.sm};

      &:first-of-type {
        border-radius: ${p => p.theme.radius.lg} 0 0 0;
      }
      &:last-of-type {
        border-radius: 0 ${p => p.theme.radius.lg} 0 0;
      }
    }

    tr:last-child td:first-of-type {
      border-radius: 0 0 0 ${p => p.theme.radius.lg};
    }
    tr:last-child td:last-of-type {
      border-radius: 0 0 ${p => p.theme.radius.lg} 0;
    }

    tbody {
      background: ${p => p.theme.tokens.background.primary};
      border-radius: 0 0 ${p => p.theme.radius.lg} ${p => p.theme.radius.lg};
    }

    tr {
      border-bottom: 1px solid ${p => p.theme.tokens.border.muted};
      vertical-align: baseline;

      &:last-child {
        border-bottom: 0;
      }
    }

    td {
      padding-inline: ${p => p.theme.space.xl};
      padding-block: ${p => p.theme.space.lg};
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
`
);
