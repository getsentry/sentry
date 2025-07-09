import type {ReactNode} from 'react';
import {Children, Fragment} from 'react';

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
        <Storybook.Title>{title}</Storybook.Title>
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
    <Storybook.Section>
      <Storybook.Title>{props.name}</Storybook.Title>
      {isOneChild ? children : <Storybook.SideBySide>{children}</Storybook.SideBySide>}
    </Storybook.Section>
  );
}
