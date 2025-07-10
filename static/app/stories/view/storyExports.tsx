import {Fragment} from 'react';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';

import {Alert} from 'sentry/components/core/alert';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {StoryFooter} from 'sentry/stories/view/storyFooter';
import {StoryTableOfContents} from 'sentry/stories/view/storyTableOfContents';
import {space} from 'sentry/styles/space';

import {StoryResources} from './storyResources';
import {StorySourceLinks} from './storySourceLinks';
import type {StoryDescriptor} from './useStoriesLoader';
import type {StoryExports as StoryExportValues} from './useStory';
import {StoryContextProvider, useStory} from './useStory';

export function StoryExports(props: {story: StoryDescriptor}) {
  return (
    <StoryContextProvider story={props.story}>
      <StoryLayout />
    </StoryContextProvider>
  );
}

function StoryLayout() {
  return (
    <Tabs>
      <StoryTitlebar />
      <StoryGrid>
        <StoryContainer>
          <StoryContent>
            <StoryTabPanels />
          </StoryContent>
          <ErrorBoundary>
            <StorySourceLinks />
          </ErrorBoundary>
          <StoryFooter />
        </StoryContainer>
        <StoryTableOfContents />
      </StoryGrid>
    </Tabs>
  );
}

function StoryTitlebar() {
  const {story} = useStory();

  const title = story.exports.frontmatter?.title;
  const description = story.exports.frontmatter?.description;

  if (!story.filename.endsWith('.mdx')) return null;

  return (
    <StoryHeader>
      <StoryGrid>
        <StoryContainer style={{gap: space(1)}}>
          <h1>{title}</h1>
          {description && <p>{description}</p>}

          <StoryTabList />
        </StoryContainer>
      </StoryGrid>
    </StoryHeader>
  );
}

function StoryTabList() {
  const {story} = useStory();
  if (!story.filename.endsWith('.mdx')) return null;

  return (
    <TabList>
      <TabList.Item key="usage">{t('Usage')}</TabList.Item>
      {story.exports.types ? <TabList.Item key="api">{t('API')}</TabList.Item> : null}
      {story.exports.frontmatter?.resources ? (
        <TabList.Item key="resources">{t('Resources')}</TabList.Item>
      ) : null}
    </TabList>
  );
}

function StoryTabPanels() {
  const {story} = useStory();
  if (!story.filename.endsWith('.mdx')) {
    return <StoryUsage />;
  }
  return (
    <TabPanels>
      <TabPanels.Item key="usage">
        <StoryUsage />
      </TabPanels.Item>
      <TabPanels.Item key="api">
        <StoryAPI />
      </TabPanels.Item>
      <TabPanels.Item key="resources">
        <StoryResources />
      </TabPanels.Item>
    </TabPanels>
  );
}
const EXPECTED_EXPORTS = new Set<keyof StoryExportValues>(['frontmatter', 'types']);

function StoryUsage() {
  const {
    story: {
      exports: {default: Story, ...namedExports},
      filename,
    },
  } = useStory();
  return (
    <Fragment>
      {Story && (
        <Storybook.Section>
          <ErrorBoundary
            fallback={
              <Alert type="error" showIcon={false}>
                Problem loading <code>{filename}</code>
              </Alert>
            }
          >
            <Story />
          </ErrorBoundary>
        </Storybook.Section>
      )}
      {Object.entries(namedExports).map(([name, MaybeComponent]) => {
        if (EXPECTED_EXPORTS.has(name as keyof StoryExportValues)) {
          return null;
        }
        if (typeof MaybeComponent === 'function') {
          return (
            <Storybook.Section key={name}>
              <MaybeComponent />
            </Storybook.Section>
          );
        }
        // eslint-disable-next-line no-console
        console.error(
          `Story exported an unsupported key ${name} with value: ${typeof MaybeComponent}`
        );
        return null;
      })}
    </Fragment>
  );
}

function StoryAPI() {
  const {story} = useStory();
  if (!story.exports.types) return null;
  return <Storybook.APIReference types={story.exports.types} />;
}

const StoryHeader = styled('header')`
  background: ${p => p.theme.tokens.background.secondary};
  padding: 32px 0 0 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  grid-area: story-head;
  h1 {
    font-size: 24px;
    font-weight: ${p => p.theme.fontWeight.bold};
  }
  p {
    margin-top: 8px;
    margin-bottom: 16px;
  }
`;

const StoryGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr minmax(auto, 360px);
  flex: 1;
  height: 100%;
`;

const StoryContainer = styled('div')`
  max-width: 820px;
  width: calc(100vw - 32px);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: ${space(4)};
  padding-inline: ${space(2)};
`;

const StoryContent = styled('main')`
  flex-grow: 1;
`;
