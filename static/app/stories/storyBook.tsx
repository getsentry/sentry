import type {ReactNode} from 'react';
import {Children, Fragment} from 'react';
import styled from '@emotion/styled';

import SideBySide from 'sentry/components/stories/sideBySide';
import {space} from 'sentry/styles/space';

type StoryRenderFunction = () => ReactNode | ReactNode[];
type StoryFunction = (storyName: string, storyRender: StoryRenderFunction) => void;
type SetupFunction = (story: StoryFunction) => void;

type StoryContext = {
  name: string;
  render: StoryRenderFunction;
};

export default function storyBook(
  bookContext: string | React.ComponentType<any>,
  setup: SetupFunction
): StoryRenderFunction {
  const contexts: StoryContext[] = [];

  const storyFn: StoryFunction = (name: string, render: StoryRenderFunction) => {
    contexts.push({name, render});
  };

  setup(storyFn);

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
        {contexts.map(({name, render}, i) => {
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
      </Fragment>
    );
  };
}

const BookTitle = styled('h3')`
  grid-area: header-title;
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
