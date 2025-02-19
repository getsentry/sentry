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
  title: string,
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

  return function RenderStory() {
    return (
      <Fragment>
        <StoryTitle>{title}</StoryTitle>
        {stories.map(({name, render}, i) => (
          <Story key={i} name={name} render={render} />
        ))}
        {APIDocumentation.map((documentation, i) => (
          <StoryTypes key={i} types={documentation} />
        ))}
      </Fragment>
    );
  };
}

function Story(props: {name: string; render: StoryRenderFunction}) {
  const children = props.render();
  const isOneChild = Children.count(children) === 1;

  return (
    <StorySection>
      <StoryTitle>{props.name}</StoryTitle>
      {isOneChild ? children : <SideBySide>{children}</SideBySide>}
    </StorySection>
  );
}

export const StorySection = styled('section')`
  margin-top: ${space(4)};

  & > p {
    margin: ${space(3)} 0;
  }
`;

export const StoryTitle = styled('h3')`
  border-bottom: 1px solid ${p => p.theme.border};
  scroll-margin-top: ${space(2)};
`;
