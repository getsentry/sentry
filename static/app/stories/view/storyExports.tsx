import React, {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';
import {useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {InlineCode} from '@sentry/scraps/code';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {APIReference} from 'sentry/stories/apiReference';

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
  type StoryDocumentation,
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
  const documentation = useStoryDocumentation(
    (isMDXStory(story) ? story.exports.documentation : story.exports.documentation) as
      | StoryDocumentation
      | undefined,
    story.filename
  );

  return (
    <Tabs value={tab} onChange={setTab}>
      {isMDXStory(story) ? <MDXStoryTitle story={story} /> : null}
      <StoryGrid>
        <Stack
          width="100%"
          minWidth="0px"
          maxWidth={{zero: '580px', '3xl': '832px'}}
          gap="3xl"
          padding="0 xl"
          margin={{zero: '0', '3xl': '0 auto'}}
        >
          <Stack flexGrow={1} minWidth="0px">
            <StoryTabPanels documentation={documentation} />
          </Stack>
          <ErrorBoundary>
            <StorySourceLinks />
          </ErrorBoundary>
          <StoryFooter />
        </Stack>
        <StoryTableOfContents />
      </StoryGrid>
    </Tabs>
  );
}

function makeStorybookDocumentTitle(title: string | undefined): string {
  return title ? `${title} — Scraps` : 'Scraps';
}

function MDXStoryTitle(props: {story: MDXStoryDescriptor}) {
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
        <Stack
          width="100%"
          minWidth="0px"
          maxWidth={{zero: '580px', '3xl': '832px'}}
          gap="2xl"
          padding="0 xl"
          margin={{zero: '0', '3xl': '0 auto'}}
        >
          <Stack
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
          </Stack>

          <StoryTabList />
        </Stack>
        <StoryTableOfContentsPlaceholder />
      </StoryGrid>
    </Container>
  );
}

function StoryTabList() {
  const {story} = useStory();

  if (!isMDXStory(story)) {
    return null;
  }
  if (story.exports.frontmatter?.layout === 'document') {
    return null;
  }

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

function StoryTabPanels(props: {documentation: TypeLoader.TypeLoaderResult | undefined}) {
  const {story} = useStory();

  if (!isMDXStory(story)) {
    return (
      <Fragment>
        <StoryUsage />
        {props.documentation && <StoryAPI documentation={props.documentation} />}
      </Fragment>
    );
  }

  // A document is just a single page
  if (story.exports.frontmatter?.layout === 'document') {
    return <StoryUsage />;
  }

  return (
    <StyledTabPanels>
      <TabPanels.Item key="usage">
        <StoryModuleExports exports={props.documentation?.exports} />
        <StoryUsage />
      </TabPanels.Item>
      <TabPanels.Item key="api">
        <StoryAPI documentation={props.documentation} />
      </TabPanels.Item>
      <TabPanels.Item key="resources">
        <StoryResources />
      </TabPanels.Item>
    </StyledTabPanels>
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
        <Storybook.Section flexGrow={1}>
          <ErrorBoundary
            fallback={
              <Alert variant="danger" showIcon={false}>
                Problem loading <InlineCode>{filename}</InlineCode>
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

function StoryAPI(props: {documentation: TypeLoader.TypeLoaderResult | undefined}) {
  if (!props.documentation || !('props' in props.documentation)) {
    return null;
  }

  return (
    <Fragment>
      {Object.entries(props.documentation.props ?? {}).map(([key, value]) => {
        return <APIReference key={key} componentProps={value} />;
      })}
    </Fragment>
  );
}

/**
 * Documentation modules are lazy-compiled in development mode so we have to fetch them.
 */
function useStoryDocumentation(
  documentation: StoryDocumentation | undefined,
  storyFilename: string
): TypeLoader.TypeLoaderResult | undefined {
  const query = useQuery({
    queryKey: ['stories-documentation', storyFilename, documentation],
    queryFn: async () => {
      if (!documentation) {
        throw new Error('Missing documentation');
      }
      const result = await documentation;
      if (result && 'default' in result) {
        return result.default;
      }
      return result;
    },
    enabled: !!documentation,
    staleTime: 60_000,
  });

  return query.data;
}

function StoryGrid(props: React.ComponentProps<typeof Grid>) {
  return (
    <Grid
      {...props}
      columns={{
        zero: 'minmax(0, 1fr) auto',
        '3xl': 'minmax(580px, 1fr) minmax(0, 256px)',
      }}
      height="100%"
    />
  );
}

function StoryModuleExports(props: {
  exports: TypeLoader.TypeLoaderResult['exports'] | undefined;
}) {
  if (!props.exports) {
    return null;
  }
  return <Storybook.ModuleExports exports={props.exports} />;
}

const StyledTabPanels = styled(TabPanels)`
  flex-grow: 1;
  min-width: 0;
`;
