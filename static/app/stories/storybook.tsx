import type {ReactNode} from 'react';
import {Children, Fragment, Suspense, lazy, useEffect} from 'react';

import {Container} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {Section, SideBySide} from './layout';

// Lazy-loaded to bypass circular dependencies on Button
const StoryHeading = lazy(() =>
  import('sentry/stories/view/storyHeading').then(m => ({default: m.StoryHeading}))
);
const APIReference = lazy(() =>
  import('./apiReference').then(m => ({default: m.APIReference}))
);

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
          <Suspense key={i} fallback={null}>
            <APIReference componentProps={documentation} />
          </Suspense>
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
        <Suspense fallback={<Heading as="h2">{props.name}</Heading>}>
          <StoryHeading as="h2" size="2xl">
            {props.name}
          </StoryHeading>
        </Suspense>
      </Container>
      {isOneChild ? children : <SideBySide>{children}</SideBySide>}
    </Section>
  );
}
