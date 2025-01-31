import type {ReactNode} from 'react';
import {Children, Fragment} from 'react';
import styled from '@emotion/styled';

import SideBySide from 'sentry/components/stories/sideBySide';
import {space} from 'sentry/styles/space';
import {StoryTypes} from 'sentry/views/stories/storyTypes';

type StoryRenderFunction = () => ReactNode | ReactNode[];
type StoryContext = (storyName: string, story: StoryRenderFunction) => void;
type SetupFunction = (
  story: StoryContext,
  apiReference: (documentation: TypeLoader.ComponentDocWithFilename | undefined) => void
) => void;

export default function storyBook(
  bookContext: string | React.ComponentType<any>,
  setup: SetupFunction
): StoryRenderFunction {
  const stories: Array<{
    name: string;
    render: StoryRenderFunction;
  }> = [];
  const APIDocumentation: TypeLoader.ComponentDocWithFilename[] = [];

  const storyFn: StoryContext = (name: string, render: StoryRenderFunction) => {
    stories.push({name, render});
  };

  const apiReferenceFn: (
    documentation: TypeLoader.ComponentDocWithFilename | undefined
  ) => void = (documentation: TypeLoader.ComponentDocWithFilename | undefined) => {
    if (documentation) {
      APIDocumentation.push(documentation);
    }
  };

  setup(storyFn, apiReferenceFn);

  // @TODO (JonasBadalic): we can props or use a context to communciate with the storyFile component
  return function RenderStory() {
    const title =
      typeof bookContext === 'string'
        ? bookContext
        : bookContext.displayName ?? bookContext.name ?? bookContext.constructor.name;

    return (
      <Fragment>
        {typeof bookContext === 'string' ? (
          <BookTitle>{title}</BookTitle>
        ) : (
          <BookTitle>
            <code>{`<${title}/>`}</code>
          </BookTitle>
        )}
        {stories.map(({name, render}, i) => {
          const children = render();
          const isOneChild = Children.count(children) === 1;
          const key = `${i}_${name}`;

          return (
            <Story key={key}>
              <StoryTitle id={key}>{name}</StoryTitle>
              {isOneChild ? children : <SideBySide>{children}</SideBySide>}
            </Story>
          );
        })}

        {APIDocumentation.map((documentation, i) => (
          <StoryTypes key={i} types={documentation} />
        ))}
      </Fragment>
    );
  };
}

const BookTitle = styled('h3')`
  margin: 0;
`;

const Story = styled('section')`
  margin-top: ${space(4)};

  & > p {
    margin: ${space(3)} 0;
  }
`;

const StoryTitle = styled('h4')`
  border-bottom: 1px solid ${p => p.theme.border};
`;
