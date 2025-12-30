import React, {Fragment, useEffect} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';
import {parseAsString, useQueryState} from 'nuqs';

import {Alert} from 'sentry/components/core/alert';
import {Tag} from 'sentry/components/core/badge/tag';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import {Heading, Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';

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
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsString.withOptions({history: 'push'}).withDefault('usage')
  );

  return (
    <Tabs value={tab} onChange={setTab}>
      {isMDXStory(story) ? <MDXStoryTitle story={story} /> : null}
      <StoryGrid>
        <StoryContainer>
          <Flex flexGrow={1} minWidth="0px">
            <StoryTabPanels />
          </Flex>
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
  return title ? `${title} — Scraps` : 'Scraps';
}

function MDXStoryTitle(props: {story: MDXStoryDescriptor}) {
  const theme = useTheme();
  const title = props.story.exports.frontmatter?.title;
  const description = props.story.exports.frontmatter?.description;

  useEffect(() => {
    document.title = makeStorybookDocumentTitle(title);
  }, [title]);

  return (
    <Container
      as="header"
      background="secondary"
      padding="3xl 0 0 0"
      borderBottom="primary"
      area="story-head"
    >
      <StoryGrid>
        <StoryContainer style={{gap: theme.space['2xl']}}>
          <Flex
            direction="column"
            gap="xl"
            padding={
              props.story.exports.frontmatter?.layout === 'document'
                ? '0 0 2xl 0'
                : undefined
            }
          >
            <Flex direction="row" gap="sm" align="center">
              <Heading as="h1">{title}</Heading>
              {props.story.exports.frontmatter?.status ? (
                props.story.exports.frontmatter.status === 'stable' ? null : (
                  <Tag
                    variant={
                      props.story.exports.frontmatter.status === 'in-progress'
                        ? 'warning'
                        : 'promotion'
                    }
                  >
                    {props.story.exports.frontmatter.status === 'in-progress'
                      ? 'In Progress'
                      : 'Experimental'}
                  </Tag>
                )
              ) : null}
            </Flex>
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
    </Container>
  );
}

function StoryTabList() {
  const {story} = useStory();

  if (!isMDXStory(story)) return null;
  if (story.exports.frontmatter?.layout === 'document') return null;

  return (
    <TabList>
      <TabList.Item key="usage">{t('Usage')}</TabList.Item>
      {story.exports.documentation ? (
        <TabList.Item key="api">{t('API')}</TabList.Item>
      ) : null}

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
        <StoryModuleExports exports={story.exports.documentation?.exports} />
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
const EXPECTED_EXPORTS = new Set<keyof StoryExportValues>([
  'frontmatter',
  'documentation',
]);

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
              <Alert variant="danger" showIcon={false}>
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

  const documentation = story.exports.documentation as TypeLoader.TypeLoaderResult;

  if (!documentation || !('props' in documentation)) {
    return null;
  }

  return (
    <Fragment>
      {Object.entries(documentation.props ?? {}).map(([key, value]) => {
        return <Storybook.APIReference key={key} componentProps={value} />;
      })}
    </Fragment>
  );
}

function StoryGrid(props: React.ComponentProps<typeof Grid>) {
  return (
    <Grid
      {...props}
      columns={{xs: 'minmax(0, 1fr) auto', md: 'minmax(580px, 1fr) minmax(0, 256px)'}}
      height="100%"
    />
  );
}

function StoryModuleExports(props: {
  exports: TypeLoader.TypeLoaderResult['exports'] | undefined;
}) {
  if (!props.exports) return null;
  return <Storybook.ModuleExports exports={props.exports} />;
}

const StoryContainer = styled('div')`
  max-width: 580px;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['3xl']};
  padding-inline: ${p => p.theme.space.xl};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    max-width: 832px;
    margin-inline: auto;
  }
`;
