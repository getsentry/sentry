import type {ComponentType} from 'react';

export type StoriesQuery = {name: string};

// Exports from a *.stories.tsx file, both default and named, do not accept props.
interface StoryProps {}

export type ResolvedStoryModule = Record<string, ComponentType<StoryProps>>;
