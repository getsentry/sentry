import type {ReactNode} from 'react';
import {Children, Fragment, useEffect} from 'react';

import {Container} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {StoryHeading} from 'sentry/stories/view/storyHeading';

import {APIReference} from './apiReference';
import {Section, SideBySide} from './layout';

function makeStorybookDocumentTitle(title: string | undefined): string {
  return title ? `${title} — Scraps` : 'Scraps';
}

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

  const storyFn: StoryContext = (name, render) => {
    stories.push({name, render});
  };

  const apiReferenceFn = (
    documentation: TypeLoader.ComponentDocWithFilename | undefined
  ) => {
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
        {stories.map(({name, render}, idx) => (
          <Story key={name + idx} name={name} render={render} />
        ))}
        {APIDocumentation.map((documentation, i) => (
          <APIReference key={i} componentProps={documentation} />
        ))}
      </Fragment>
    );
  };
}

function Story(props: {name: string; render: StoryRenderFunction}) {
  const children = props.render();
  const isOneChild = Children.count(children) === 1;

  return (
    <Section>
      <Container borderBottom="primary">
        <StoryHeading as="h2" size="2xl">
          {props.name}
        </StoryHeading>
      </Container>
      {isOneChild ? children : <SideBySide>{children}</SideBySide>}
    </Section>
  );
}
