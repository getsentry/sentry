import {Fragment, ReactNode, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import SideBySide from 'sentry/components/stories/sideBySide';
import {space} from 'sentry/styles/space';

type RenderFn = () => ReactNode | ReactNode[] | Promise<ReactNode> | Promise<ReactNode[]>;
type StoryFn = (storyName: string, storyRender: RenderFn) => Promise<void>;
type SetupFn = (story: StoryFn) => void | Promise<void>;

type Context = {
  children: ReactNode[];
  isResolved: boolean;
  rootName: string;
  storyName: string;
};

export default function storyBook(rootName: string, setup: SetupFn) {
  return function RenderStory() {
    const [contexts, setContexts] = useState<Context[]>([]);

    const storyFn = useCallback(async (storyName: string, storyRender: RenderFn) => {
      const context: Context = {
        rootName,
        storyName,
        children: [<Placeholder key="placeholder" />],
        isResolved: false,
      };

      setContexts(prev => [...prev, context]);
      const finished = await storyRender();
      context.children = [finished];

      setContexts(prev => [...prev]);
    }, []);

    useEffect(() => {
      setup(storyFn);
    }, [storyFn]);

    const items = contexts.map(context => (
      <Section
        key={context.rootName + context.storyName}
        rootName={context.rootName}
        name={context.storyName}
      >
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
  rootName: string;
}
function Section({rootName, name, children}: SectionProps) {
  return (
    <Story>
      <StoryTitle id={`${rootName}_${name}`}>{name}</StoryTitle>
      {children}
    </Story>
  );
}

const Story = styled('section')`
  margin-bottom: ${space(4)};
`;

const StoryTitle = styled('h4')`
  border-bottom: 1px solid ${p => p.theme.border};
`;
