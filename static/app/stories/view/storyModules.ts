import type {MDXStoryExports, TSStoryExports} from './storyDescriptor';

export const tsStoryModules = import.meta.glob<TSStoryExports>('./**/*.stories.tsx', {
  base: '../../',
});

export const mdxStoryModules = import.meta.glob<MDXStoryExports>('./**/*.mdx', {
  base: '../../',
});
