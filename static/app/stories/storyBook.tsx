import {Children, JSXElementConstructor, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/profiling/flex';
import SideBySide from 'sentry/components/stories/sideBySide';
import {space} from 'sentry/styles/space';

type RenderFn = () => ReactNode | ReactNode[];
type StoryFn = (storyName: string, storyRender: RenderFn) => void;
type SetupFn = (story: StoryFn) => void;

type Context = {
  name: string;
  render: RenderFn;
};

export default function storyBook(
  bookContext: string | JSXElementConstructor<any>,
  setup: SetupFn
) {
  const contexts: Context[] = [];

  const storyFn: StoryFn = (name: string, render: RenderFn) => {
    contexts.push({name, render});
  };

  setup(storyFn);

  return function RenderStory() {
    return (
      <Flex column gap={space(4)}>
        <BookHeading bookContext={bookContext} />
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
      </Flex>
    );
  };
}

function BookHeading({bookContext}) {
  if (typeof bookContext === 'string') {
    return <BookTitle>{bookContext}</BookTitle>;
  }

  const componentName =
    bookContext.displayName ?? bookContext.name ?? bookContext.constructor.name;

  if (!componentName) {
    return null;
  }

  return (
    <BookTitle>
      <code>{`<${componentName}/>`}</code>
    </BookTitle>
  );
}

const BookTitle = styled('h3')`
  margin: 0;
`;

const Story = styled('section')`
  & > p {
    margin: ${space(3)} 0;
  }
`;

const StoryTitle = styled('h4')`
  border-bottom: 1px solid ${p => p.theme.border};
`;
