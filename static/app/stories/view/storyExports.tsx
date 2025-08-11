import React, {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';

import {Alert} from 'sentry/components/core/alert';
import {Flex, Grid} from 'sentry/components/core/layout';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import {Heading, Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

import {StoryFooter} from './storyFooter';
import {storyMdxComponents} from './storyMdxComponent';
import {StoryResources} from './storyResources';
import {StorySourceLinks} from './storySourceLinks';
import {
  StoryTableOfContents,
  StoryTableOfContentsPlaceholder,
} from './storyTableOfContents';
import {
  isMDXStory,
  type MDXStoryDescriptor,
  type StoryDescriptor,
} from './useStoriesLoader';
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
  const {story} = useStory();
  return (
    <Tabs>
      {isMDXStory(story) ? <MDXStoryTitle story={story} /> : null}
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

export function makeStorybookDocumentTitle(title: string | undefined): string {
  return title ? `${title} — Sentry UI` : 'Sentry UI';
}

function MDXStoryTitle(props: {story: MDXStoryDescriptor}) {
  const title = props.story.exports.frontmatter?.title;
  const description = props.story.exports.frontmatter?.description;

  useEffect(() => {
    document.title = makeStorybookDocumentTitle(title);
  }, [title]);

  return (
    <StoryHeader>
      <StoryGrid>
        <StoryContainer style={{gap: space(3)}}>
          <Flex
            direction="column"
            gap="xl"
            padding={
              props.story.exports.frontmatter?.layout === 'document'
                ? '0 0 2xl 0'
                : undefined
            }
          >
            <Heading as="h1">{title}</Heading>
            {description && (
              <Text as="p" density="comfortable">
                {description}
              </Text>
            )}
          </Flex>

          <StoryTabList />
        </StoryContainer>
        <StoryTableOfContentsPlaceholder />
      </StoryGrid>
    </StoryHeader>
  );
}

function StoryTabList() {
  const {story} = useStory();
  if (!isMDXStory(story)) return null;
  if (story.exports.frontmatter?.layout === 'document') return null;

  return (
    <TabList>
      <TabList.Item key="usage">{t('Usage')}</TabList.Item>
      {story.exports.types ? <TabList.Item key="api">{t('API')}</TabList.Item> : null}

      {isMDXStory(story) && story.exports.frontmatter?.resources ? (
        <TabList.Item key="resources">{t('Resources')}</TabList.Item>
      ) : null}
    </TabList>
  );
}

function StoryTabPanels() {
  const {story} = useStory();
  if (!isMDXStory(story)) {
    return <StoryUsage />;
  }

  // A document is just a single page
  if (story.exports.frontmatter?.layout === 'document') {
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
            <Story components={storyMdxComponents} />
          </ErrorBoundary>
        </Storybook.Section>
      )}
      {Object.entries(namedExports).map(([name, MaybeComponent]) => {
        if (filename.endsWith('.mdx')) {
          return null;
        }
        if (EXPECTED_EXPORTS.has(name as keyof StoryExportValues)) {
          return null;
        }
        if (typeof MaybeComponent === 'function') {
          const Component = MaybeComponent as React.ComponentType;
          return (
            <Storybook.Section key={name}>
              <Component />
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

  if (
    typeof story.exports.types === 'object' &&
    story.exports.types !== null &&
    'filename' in story.exports.types
  ) {
    return (
      <Storybook.APIReference
        types={story.exports.types as TypeLoader.ComponentDocWithFilename}
      />
    );
  }

  return (
    <Fragment>
      {Object.entries(story.exports.types).map(([key, value]) => {
        return <Storybook.APIReference key={key} types={value} />;
      })}
    </Fragment>
  );
}

const StoryHeader = styled('header')`
  background: ${p => p.theme.tokens.background.secondary};
  padding: 32px 0 0 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  grid-area: story-head;
`;

function StoryGrid(props: React.ComponentProps<typeof Grid>) {
  return (
    <Grid
      {...props}
      columns={{xs: 'minmax(0, 1fr) auto', md: 'minmax(580px, 1fr) minmax(0, 256px)'}}
      height="100%"
    />
  );
}

const StoryContainer = styled('div')`
  max-width: 580px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${space(4)};
  padding-inline: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    max-width: 832px;
    margin-inline: auto;
  }
`;

const StoryContent = styled('main')`
  flex-grow: 1;
`;
