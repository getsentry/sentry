import type {MDXFrontmatter} from './frontmatter';

declare module '*.mdx' {
  export const frontmatter: MDXFrontmatter;
  export const documentation: TypeLoader.TypeLoaderResult;
}
