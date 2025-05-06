import {Fragment} from 'react';
import styled from '@emotion/styled';
import {ErrorBoundary} from '@sentry/react';

import {space} from 'sentry/styles/space';
import {StorySourceLinks} from 'sentry/views/stories/storySourceLinks';

import type {StoryDescriptor} from './useStoriesLoader';

export function StoryExports(props: {story: StoryDescriptor}) {
  const {default: DefaultExport, ...namedExports} = props.story.exports;

  return (
    <Fragment>
      <StorySourceLinksContainer>
        <ErrorBoundary>
          <StorySourceLinks story={props.story} />
        </ErrorBoundary>
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

const StorySourceLinksContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  justify-content: flex-end;
  margin-top: ${space(1.5)};
`;

const Story = styled('section')`
  padding-top: ${space(2)};
`;
