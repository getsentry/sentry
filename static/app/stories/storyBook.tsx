import type {ReactNode} from 'react';
import {Children, Fragment} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {StoryTypes} from 'sentry/views/stories/storyTypes';

const SideBySide = styled('div')`
  display: flex;
  gap: ${space(2)};
  flex-wrap: wrap;
  align-items: flex-start;
`;

type StoryRenderFunction = () => ReactNode | ReactNode[];
interface StoryContext {
  (storyName: string, story: StoryRenderFunction): void;
  APIReference: (documentation: TypeLoader.ComponentDocWithFilename | undefined) => void;
  SideBySide: typeof SideBySide;
}

type SetupFunction = (story: StoryContext) => void;

export default function StoryBook(
  title: string,
  setup: SetupFunction
): StoryRenderFunction {
  const stories: Array<{
    name: string;
    render: StoryRenderFunction;
  }> = [];
  const APIDocumentation: Array<TypeLoader.ComponentDocWithFilename | undefined> = [];
  const APIReference: (
    documentation: TypeLoader.ComponentDocWithFilename | undefined
  ) => void = (documentation: TypeLoader.ComponentDocWithFilename | undefined) => {
    APIDocumentation.push(documentation);
  };

  function storyFn(name: string, render: StoryRenderFunction) {
    stories.push({name, render});
  }

  Object.assign(storyFn, {
    SideBySide,
    APIReference,
  });

  setup(storyFn as StoryContext);

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
