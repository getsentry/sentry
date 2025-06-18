import {Fragment} from 'react';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';

import {Badge} from 'sentry/components/core/badge';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import {IconArrow, IconGithub} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
import {APIReference} from 'sentry/stories/apiReference';
import {StoryTableOfContents} from 'sentry/stories/view/storyTableOfContents';
import {space} from 'sentry/styles/space';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';

import {StorySourceLinks} from './storySourceLinks';
import type {StoryDescriptor, StoryResources} from './useStoriesLoader';

export function StoryExports(props: {story: StoryDescriptor}) {
  if (props.story.filename.endsWith('.mdx')) {
    return <UI2Story story={props.story} />;
  }

  return <LegacyStory story={props.story} />;
}

function LegacyStory(props: {story: StoryDescriptor}) {
  const {default: DefaultExport, ...namedExports} = props.story.exports;
  return (
    <Fragment>
      <StorySourceLinksContainer>
        <Flex justify="flex-end" align="center" gap={1}>
          <ErrorBoundary>
            <StorySourceLinks story={props.story} />
          </ErrorBoundary>
        </Flex>
      </StorySourceLinksContainer>
      {/* Render default export first */}
      {DefaultExport ? (
        <Story key="default">
          <DefaultExport />
        </Story>
      ) : null}
      {Object.entries(namedExports).map(([name, MaybeComponent]) => {
        if (typeof MaybeComponent === 'function') {
          return (
            <Story key={name}>
              <MaybeComponent />
            </Story>
          );
        }

        throw new Error(
          `Story exported an unsupported key ${name} with value: ${typeof MaybeComponent}`
        );
      })}
    </Fragment>
  );
}

function UI2Story(props: {story: StoryDescriptor}) {
  const {default: DefaultExport, frontmatter = {}, types = {}} = props.story.exports;
  const title = frontmatter.title ?? props.story.filename;

  return (
    <StyledTabs>
      <StoryHeaderBar>
        <StoryGrid>
          <StoryContainer>
            <h1>{title}</h1>
            {frontmatter.description && <p>{frontmatter.description}</p>}

            <TabList>
              <TabList.Item key="usage">Usage</TabList.Item>
              {types ? <TabList.Item key="api">API</TabList.Item> : null}
              {frontmatter.resources ? (
                <TabList.Item key="resources">Resources</TabList.Item>
              ) : null}
            </TabList>
          </StoryContainer>
        </StoryGrid>
      </StoryHeaderBar>
      <StoryGrid>
        <StoryContainer>
          <main>
            <TabPanels>
              <TabPanels.Item key="usage">
                <Storybook.Section>
                  <DefaultExport />
                </Storybook.Section>
              </TabPanels.Item>
              {frontmatter.resources ? (
                <TabPanels.Item key="resources">
                  <Storybook.Section>
                    <StoryResources story={props.story} />
                  </Storybook.Section>
                </TabPanels.Item>
              ) : null}
              {types ? (
                <TabPanels.Item key="api">
                  <APIReference types={types} />
                </TabPanels.Item>
              ) : null}
            </TabPanels>
          </main>

          <StorySourceLinksContainer>
            <Flex justify="flex-end" align="center" gap={1} style={{marginTop: space(4)}}>
              <ErrorBoundary>
                <StorySourceLinks story={props.story} />
              </ErrorBoundary>
            </Flex>
          </StorySourceLinksContainer>
          <Flex
            align="center"
            justify="space-between"
            gap={space(2)}
            style={{marginBottom: space(4)}}
          >
            <Card href="#" icon={<IconArrow direction="left" />}>
              <CardLabel>Previous</CardLabel>
              <CardTitle>Banner</CardTitle>
            </Card>
            <Card data-flip href="#" icon={<IconArrow direction="right" />}>
              <CardLabel>Next</CardLabel>
              <CardTitle>Card</CardTitle>
            </Card>
          </Flex>
        </StoryContainer>

        <StoryTableOfContents />
      </StoryGrid>
    </StyledTabs>
  );
}

const Card = styled(LinkButton)`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 80px;

  span:last-child {
    width: 100%;
    display: grid;
    grid-template-areas:
      'icon label'
      'icon text';
    grid-template-columns: auto 1fr;
    place-content: center;
    column-gap: ${space(1)};
  }

  &[data-flip] span:last-child {
    grid-template-areas:
      'label icon'
      'text icon';
    grid-template-columns: 1fr auto;
    justify-content: flex-end;
    text-align: right;
  }

  span:has(svg) {
    grid-area: icon;
  }
`;
const CardLabel = styled('div')`
  color: ${p => p.theme.tokens.content.muted};
`;
const CardTitle = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: 20px;
`;

const StyledTabs = styled(Tabs)`
  display: contents;
`;

const StoryHeaderBar = chonkStyled('header')`
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${p => `${p.theme.space['3xl']} 0 0 0`};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  grid-area: story-head;

  h1 {
    font-size: 24px;
    font-weight: ${p => p.theme.fontWeightBold};
  }
  p {
    margin-top: ${p => p.theme.space.md};
    margin-bottom: ${p => p.theme.space.xl};
  }
`;

const StoryGrid = chonkStyled('div')`
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

function StoryResources(props: {story: StoryDescriptor}) {
  if (!props.story.exports.frontmatter?.resources) {
    return null;
  }
  const resources: StoryResources = props.story.exports.frontmatter.resources;

  return (
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Resource</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(resources).map(([type, data]) => {
          switch (type) {
            case 'figma':
              return <FigmaResource href={data} />;
            case 'js':
              return <JsResource href={data} />;
            case 'a11y':
              return <A11yResource items={data} />;
            default:
              return null;
          }
        })}
      </tbody>
    </table>
  );
}

function IconFigma() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12.75 15.373a3.999 3.999 0 0 0 6.195-4.654A4 4 0 0 0 17.583 9a4 4 0 0 0 1.668-3.25a4 4 0 0 0-4-4h-6.5A4 4 0 0 0 6.418 9a4 4 0 0 0 0 6.5a4 4 0 1 0 6.332 3.25zm-4-12.123a2.5 2.5 0 1 0 0 5h2.5v-5zm2.5 13h-2.5a2.5 2.5 0 1 0 2.5 2.5zm-2.5-6.5a2.5 2.5 0 0 0 0 5h2.5v-5zm4 2.5a2.5 2.5 0 1 0 5.001 0a2.5 2.5 0 0 0-5.001 0m2.5-4a2.5 2.5 0 1 0 0-5h-2.5v5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FigmaResource(props: {href: string}) {
  return (
    <tr>
      <td>Design</td>
      <td>
        <LinkButton href={props.href} icon={<IconFigma />} size="sm" external>
          Open in Figma
        </LinkButton>
      </td>
      <td>
        <Badge type="new">Available</Badge>
      </td>
    </tr>
  );
}

function JsResource(props: {href: string}) {
  return (
    <tr>
      <td>Implementation</td>
      <td>
        <LinkButton href={props.href} icon={<IconGithub />} size="sm" external>
          Open in GitHub
        </LinkButton>
      </td>
      <td>
        <Badge type="beta">In Progress</Badge>
      </td>
    </tr>
  );
}

function A11yResource(props: {items: Record<string, string>}) {
  return (
    <tr>
      <td>Accessibility</td>
      <td>
        <ul style={{listStyle: 'none', padding: 0}}>
          {Object.entries(props.items).map(([text, href]) => (
            <li style={{padding: `${space(0.5)} 0`}} key={href}>
              <a target="_blank" href={href} rel="noreferrer">
                {text}
              </a>
            </li>
          ))}
        </ul>
      </td>
      <td>
        <Badge type="internal">Reference</Badge>
      </td>
    </tr>
  );
}

const StorySourceLinksContainer = styled('div')`
  margin-top: auto;
  padding-top: ${space(1.5)};
`;

const Story = styled('section')`
  padding-top: ${space(2)};

  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
