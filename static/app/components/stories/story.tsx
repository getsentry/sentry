import {Fragment, ReactNode} from 'react';

import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';

type RenderFn = () => ReactNode | ReactNode[];
type StoryFn = (storyName: string, storyRender: RenderFn) => ReactNode | ReactNode[];
type SetupFn = (story: StoryFn) => void | Promise<void>;

export function describe(rootName: string, setup: SetupFn) {
  const contexts: unknown[] = [];

  const storyFn = async (storyName: string, storyRender: RenderFn) => {
    const children: unknown[] = [];
    contexts.push({rootName, storyName, children});

    const finished = await storyRender();
    children.push(finished);
  };

  setup(storyFn);

  return function RenderStory() {
    const items = contexts.map(context => doRender(context.children));
    return <Fragment>{items}</Fragment>;
  };
}

function doRender(children: ReactNode | ReactNode[]) {
  if (Array.isArray(children)) {
    return <SideBySide>{children}</SideBySide>;
  }
  return function () {
    return <SizingWindow>{children}</SizingWindow>;
  };
}
