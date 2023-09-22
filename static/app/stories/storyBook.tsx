import {Children, Fragment, ReactNode} from 'react';
import styled from '@emotion/styled';

import SideBySide from 'sentry/components/stories/sideBySide';
import {space} from 'sentry/styles/space';

type RenderFn = () => ReactNode | ReactNode[];
type StoryFn = (storyName: string, storyRender: RenderFn) => void;
type SetupFn = (story: StoryFn) => void;

type Context = {
  name: string;
  render: RenderFn;
};

export default function storyBook(rootName: string, setup: SetupFn) {
  const contexts: Context[] = [];

  const storyFn: StoryFn = (name: string, render: RenderFn) => {
    contexts.push({name, render});
  };

  setup(storyFn);

  return function RenderStory() {
    return (
      <Fragment>
        {rootName ? <h3>{rootName}</h3> : null}
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

const Story = styled('section')`
  margin-bottom: ${space(4)};

  & > p {
    margin: ${space(3)} 0;
  }
`;

const StoryTitle = styled('h4')`
  border-bottom: 1px solid ${p => p.theme.border};
`;
