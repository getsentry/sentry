import {Fragment} from 'react';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';

import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {StoryFooter} from 'sentry/stories/view/storyFooter';
import {StoryTableOfContents} from 'sentry/stories/view/storyTableOfContents';
import {space} from 'sentry/styles/space';

import {StorySourceLinks} from './storySourceLinks';
import type {StoryDescriptor} from './useStoriesLoader';
import {StoryContextProvider, useStory} from './useStory';

export function StoryExports(props: {story: StoryDescriptor}) {
  return (
    <StoryContextProvider story={props.story}>
      <StoryLayout />
    </StoryContextProvider>
  );
}

function StoryLayout() {
  const {story} = useStory();
  const title = story.filename;
  const description = story.exports.default;

  return (
    <Tabs>
      <StoryHeader>
        <StoryGrid>
          <StoryContainer>
            <h1>{title}</h1>
            {description && <p>{description}</p>}

            <StoryTabList />
          </StoryContainer>
        </StoryGrid>
      </StoryHeader>
      <StoryGrid>
        <StoryContainer>
          <main>
            <StoryTabPanels />
          </main>
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

function StoryTabList() {
  return (
    <TabList>
      <TabList.Item key="usage">{t('Usage')}</TabList.Item>
      <TabList.Item key="api">{t('API')}</TabList.Item>
      <TabList.Item key="resources">{t('Resources')}</TabList.Item>
    </TabList>
  );
}

function StoryTabPanels() {
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

function StoryUsage() {
  const {
    story: {
      exports: {default: Story, ...namedExports},
    },
  } = useStory();
  return (
    <Fragment>
      {Story && (
        <Storybook.Section>
          <Story />
        </Storybook.Section>
      )}
      {Object.entries(namedExports).map(([name, MaybeComponent]) => {
        if (typeof MaybeComponent === 'function') {
          return (
            <Storybook.Section key={name}>
              <MaybeComponent />
            </Storybook.Section>
          );
        }
        throw new Error(
          `Story exported an unsupported key ${name} with value: ${typeof MaybeComponent}`
        );
      })}
    </Fragment>
  );
}

function StoryResources() {
  const {story} = useStory();
  if (!story.exports.frontmatter?.resources) return null;
  return (
    <TabPanels.Item key="resources">
      <Storybook.Section>{/* TODO */}</Storybook.Section>
    </TabPanels.Item>
  );
}

function StoryAPI() {
  const {story} = useStory();
  if (!story.exports.types) return null;
  return (
    <TabPanels.Item key="api">
      <Storybook.APIReference types={story.exports.types} />
    </TabPanels.Item>
  );
}

const StoryHeader = styled('header')`
  background: ${p => p.theme.tokens.background.secondary};
  padding: 32px 0 0 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  grid-area: story-head;
  h1 {
    font-size: 24px;
    font-weight: ${p => p.theme.fontWeightBold};
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
`;

const StoryContainer = styled('div')`
  max-width: 820px;
  width: calc(100vw - 32px);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding-inline: ${space(2)};
`;
