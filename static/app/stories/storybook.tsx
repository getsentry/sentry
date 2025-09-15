import type {ReactNode} from 'react';
import {Children, Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Heading} from 'sentry/components/core/text';
import {makeStorybookDocumentTitle} from 'sentry/stories/view/storyExports';
import {StoryHeading} from 'sentry/stories/view/storyHeading';

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
    useEffect(() => {
      document.title = makeStorybookDocumentTitle(title);
    }, []);

    return (
      <Fragment>
        <Heading as="h1">{title}</Heading>
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
      <StoryHeadingContainer>
        <StoryHeading as="h2" size="2xl">
          {props.name}
        </StoryHeading>
      </StoryHeadingContainer>
      {isOneChild ? children : <Storybook.SideBySide>{children}</Storybook.SideBySide>}
    </Storybook.Section>
  );
}

const StoryHeadingContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;
