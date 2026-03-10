import type React from 'react';
import {useMemo, useSyncExternalStore} from 'react';

import {useQuery, type UseQueryResult} from 'sentry/utils/queryClient';

let context = import.meta.webpackContext('sentry', {
  recursive: true,
  regExp: /\.stories.tsx$/,
  mode: 'lazy',
});
let mdxContext = import.meta.webpackContext('sentry', {
  recursive: true,
  regExp: /\.mdx$/,
  mode: 'lazy',
});

// External store that increments whenever HMR replaces a story or mdx file.
// Accepting context module IDs creates proper HMR boundaries — without this,
// updates are silently dropped or cause "unexpected require from disposed module".
let _storiesHmrVersion = 0;
const _storiesHmrListeners = new Set<() => void>();

if (process.env.NODE_ENV === 'development' && import.meta.webpackHot) {
  const onUpdate = () => {
    // Re-capture and re-register after each replacement — the old context
    // reference is stale and its replacement won't have accept handlers.
    context = import.meta.webpackContext('sentry', {
      recursive: true,
      regExp: /\.stories.tsx$/,
      mode: 'lazy',
    });
    mdxContext = import.meta.webpackContext('sentry', {
      recursive: true,
      regExp: /\.mdx$/,
      mode: 'lazy',
    });
    import.meta.webpackHot!.accept(context.id as string, onUpdate);
    import.meta.webpackHot!.accept(mdxContext.id as string, onUpdate);
    _storiesHmrVersion++;
    _storiesHmrListeners.forEach(l => l());
  };
  import.meta.webpackHot.accept(context.id as string, onUpdate);
  import.meta.webpackHot.accept(mdxContext.id as string, onUpdate);
}

function subscribeToStoriesHmr(listener: () => void) {
  _storiesHmrListeners.add(listener);
  return () => _storiesHmrListeners.delete(listener);
}

function getStoriesHmrVersion() {
  return _storiesHmrVersion;
}

export interface StoryResources {
  a11y?: Record<string, string>;
  figma?: string;
  js?: string;
  reference?: Record<string, string>;
}

export type StoryDocumentation = Promise<
  TypeLoader.TypeLoaderResult | {default: TypeLoader.TypeLoaderResult}
>;

export interface MDXStoryDescriptor {
  exports: {
    default: React.ComponentType | any;
    documentation?: StoryDocumentation;
    frontmatter?: {
      description: string;
      title: string;
      layout?: 'document';
      resources?: StoryResources;
      source?: string;
      status?: 'in-progress' | 'experimental' | 'stable';
      types?: string;
    };
  };
  filename: string;
}

interface TSStoryDescriptor {
  exports: Record<string, React.ComponentType | unknown>;
  filename: string;
}

export type StoryDescriptor = MDXStoryDescriptor | TSStoryDescriptor;

export function isMDXStory(story: StoryDescriptor): story is MDXStoryDescriptor {
  return story.filename.endsWith('.mdx');
}

export function useStoryBookFiles() {
  return useMemo(
    () =>
      [...context.keys(), ...mdxContext.keys()].map(file =>
        file.replace(/^\.\//, 'app/')
      ),
    []
  );
}

async function importStory(filename: string): Promise<StoryDescriptor> {
  if (!filename) {
    throw new Error(`Filename is required, got ${filename}`);
  }

  if (filename.endsWith('.mdx')) {
    const story = await mdxContext(filename.replace(/^app\//, './'));
    return {
      exports: story,
      filename,
    };
  }

  const story = await context(filename.replace(/^app\//, './'));
  return {
    exports: story,
    filename,
  };
}

interface UseStoriesLoaderOptions {
  files: string[];
}

export function useStoriesLoader(
  options: UseStoriesLoaderOptions
): UseQueryResult<StoryDescriptor[], Error> {
  const hmrVersion = useSyncExternalStore(subscribeToStoriesHmr, getStoriesHmrVersion);
  return useQuery({
    queryKey: [options.files, hmrVersion],
    queryFn: (): Promise<StoryDescriptor[]> => {
      return Promise.all(options.files.map(importStory));
    },
    enabled: options.files.length > 0,
  });
}
