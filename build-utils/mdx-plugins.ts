import remarkCallout, {type Callout} from '@r4ai/remark-callout';
import rehypeExpressiveCode from 'rehype-expressive-code';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

import {remarkUnwrapMdxParagraphs} from './remark-unwrap-mdx-paragraphs.ts';

/**
 * Shared remark plugins for MDX processing.
 *
 * Used by rspack.config.ts (build) and mdx-typecheck.ts (type checking).
 * Order matters — plugins run in array order.
 */
export const remarkPlugins = [
  remarkUnwrapMdxParagraphs,
  remarkFrontmatter,
  remarkMdxFrontmatter,
  remarkGfm,
  [
    remarkCallout,
    {
      root: (callout: Callout) => {
        return {
          tagName: 'Callout',
          properties: {
            title: callout.title,
            type: callout.type.toLowerCase(),
            isFoldable: callout.isFoldable ?? false,
            defaultFolded: callout.defaultFolded ?? false,
          },
        };
      },
    },
  ],
];

/**
 * Shared rehype plugins for MDX processing.
 *
 * Used by rspack.config.ts (build).
 */
export const rehypePlugins = [
  [
    rehypeExpressiveCode,
    {
      useDarkModeMediaQuery: false,
    },
  ],
];
