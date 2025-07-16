import type {MDXProps} from 'mdx/types';

declare module '*.mdx' {
  import type {ComponentType} from 'react';
  
  const MDXComponent: ComponentType<MDXProps>;
  export default MDXComponent;
  
  // Support for named exports from MDX files
  export const meta?: Record<string, any>;
  export const frontMatter?: Record<string, any>;
  export const types?: Record<string, any>;
}

// Additional support for MDX content with frontmatter
declare module '*.mdx?frontmatter' {
  const frontmatter: Record<string, any>;
  export default frontmatter;
}

// Support for MDX files imported as raw content
declare module '*.mdx?raw' {
  const content: string;
  export default content;
}

// Support for importing MDX content types
declare module '!!type-loader!*' {
  const types: Record<string, any>;
  export default types;
}