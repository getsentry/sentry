import {createContext, useContext} from 'react';

import type {StoryDescriptor} from './useStoriesLoader';

interface StoryContextValue {
  story?: StoryDescriptor;
}

const StoryContext = createContext<StoryContextValue>({story: undefined});
export function useStory() {
  const context = useContext(StoryContext);
  if (!context.story) {
    throw new Error(`Wrap useStory in a StoryContext.Provider`);
  }
  return context as Required<StoryContextValue>;
}
export function StoryContextProvider(props: {
  children: React.ReactNode;
  story: StoryDescriptor;
}) {
  return <StoryContext.Provider value={props}>{props.children}</StoryContext.Provider>;
}
