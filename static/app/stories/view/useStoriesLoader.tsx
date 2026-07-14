import {useSyncExternalStore} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {UseQueryResult} from '@tanstack/react-query';

import type {StoryDescriptor} from './storyDescriptor';
import {mdxStoryModules, tsStoryModules} from './storyModules';

const listeners = new Set<() => void>();
let storyFiles = listStoryFiles();
let storyRevision = 0;

// Keep this module stable while Rspack replaces the glob module. ESM bindings
// are updated before the callback, including added or removed glob matches.
if (import.meta.webpackHot) {
  import.meta.webpackHot.accept('./storyModules', () => {
    storyFiles = listStoryFiles();
    storyRevision++;
    listeners.forEach(listener => listener());
  });
}

function listStoryFiles(): string[] {
  return [...Object.keys(tsStoryModules), ...Object.keys(mdxStoryModules)].map(
    moduleKey => `app/${moduleKey.slice('./'.length)}`
  );
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getStoryFiles(): string[] {
  return storyFiles;
}

function getStoryRevision(): number {
  return storyRevision;
}

export function useStoryBookFiles(): string[] {
  return useSyncExternalStore(subscribe, getStoryFiles, getStoryFiles);
}

interface UseStoriesLoaderOptions {
  files: string[];
}

export function useStoriesLoader(
  options: UseStoriesLoaderOptions
): UseQueryResult<StoryDescriptor[]> {
  const revision = useSyncExternalStore(subscribe, getStoryRevision, getStoryRevision);

  return useQuery({
    queryKey: ['stories', options.files, revision],
    queryFn: () => Promise.all(options.files.map(loadStory)),
    enabled: options.files.length > 0,
  });
}

async function loadStory(filename: string): Promise<StoryDescriptor> {
  if (filename.endsWith('.mdx')) {
    return {
      exports: await loadStoryModule(mdxStoryModules, filename),
      filename,
    };
  }

  return {
    exports: await loadStoryModule(tsStoryModules, filename),
    filename,
  };
}

async function loadStoryModule<T>(
  modules: Record<string, () => Promise<T>>,
  filename: string
): Promise<T> {
  const moduleKey = `./${filename.replace(/^app\//, '')}`;
  const loadModule = modules[moduleKey];

  if (!loadModule) {
    throw new Error(`Story module not found: ${filename}`);
  }

  return loadModule();
}
