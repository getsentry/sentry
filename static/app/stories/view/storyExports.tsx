import {Fragment} from 'react';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';

import {Flex} from 'sentry/components/core/layout';
import {space} from 'sentry/styles/space';

import {StorySourceLinks} from './storySourceLinks';
import type {StoryDescriptor} from './useStoriesLoader';

export function StoryExports(props: {story: StoryDescriptor}) {
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
      {props.story.filename.endsWith('.mdx')
        ? null
        : Object.entries(namedExports).map(([name, MaybeComponent]) => {
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

const StorySourceLinksContainer = styled('div')`
  margin-top: ${space(1.5)};
`;

const Story = styled('section')`
  padding-top: ${space(2)};
`;
