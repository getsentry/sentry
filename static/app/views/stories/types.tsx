import type {ComponentType} from 'react';

export type StoriesQuery = {name: string};

export type ResolvedStoryModule = Record<string, ComponentType>;
