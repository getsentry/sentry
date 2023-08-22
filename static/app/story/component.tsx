import {Fragment, ReactNode} from 'react';

import SideBySide from 'sentry/components/stories/sideBySide';

type RenderFn = () => ReactNode | ReactNode[];
type StoryFn = (storyName: string, storyRender: RenderFn) => ReactNode | ReactNode[];
type SetupFn = (story: StoryFn) => void | Promise<void>;

type Context = {
  children: ReactNode[];
  isResolved: boolean;
  rootName: string;
  storyName: string;
};

export default function component(rootName: string, setup: SetupFn) {
  const contexts: Context[] = [];

  const storyFn = async (storyName: string, storyRender: RenderFn) => {
    const context = {rootName, storyName, children, isResolved: false};
    contexts.push(context);

    const finished = await storyRender();
    context.children.push(finished);
  };

  setup(storyFn);

  return function RenderStory() {
    const items = contexts.map(context => (
      <Section key={context.rootName + context.storyName} name={context.storyName}>
        {doRender(context.children)}
      </Section>
    ));
    return <Fragment>{items}</Fragment>;
  };
}

function doRender(children: ReactNode | ReactNode[]) {
  if (Array.isArray(children)) {
    return <SideBySide>{children}</SideBySide>;
  }
  return function () {
    return children;
  };
}

interface SectionProps {
  children: ReactNode;
  name: string;
}
function Section({name, children}: SectionProps) {
  return (
    <Fragment>
      <h4>{name}</h4>
      {children}
    </Fragment>
  );
}
