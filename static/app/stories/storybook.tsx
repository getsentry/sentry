import type {ReactNode} from 'react';
import {Children, Fragment} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import * as Storybook from './';

type StoryRenderFunction = () => ReactNode | ReactNode[];
type StoryContext = (storyName: string, story: StoryRenderFunction) => void;
type SetupFunction = (
  story: StoryContext,
  apiReference: (documentation: TypeLoader.ComponentDocWithFilename | undefined) => void
) => void;

export function story(title: string, setup: SetupFunction): StoryRenderFunction {
  const stories: Array<{
    name: string;
    render: StoryRenderFunction;
  }> = [];
  const APIDocumentation: Array<TypeLoader.ComponentDocWithFilename | undefined> = [];

  const storyFn: StoryContext = (name: string, render: StoryRenderFunction) => {
    stories.push({name, render});
  };

  const apiReferenceFn: (
    documentation: TypeLoader.ComponentDocWithFilename | undefined
  ) => void = (documentation: TypeLoader.ComponentDocWithFilename | undefined) => {
    APIDocumentation.push(documentation);
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
          <Storybook.APIReference key={i} types={documentation} />
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
      {isOneChild ? children : <Storybook.SideBySide>{children}</Storybook.SideBySide>}
    </StorySection>
  );
}

const StorySection = styled('section')`
  margin-top: ${space(4)};

  & > p {
    margin: ${space(3)} 0;
  }
`;

const StoryTitle = styled('h3')`
  border-bottom: 1px solid ${p => p.theme.border};
  scroll-margin-top: ${space(2)};
`;
