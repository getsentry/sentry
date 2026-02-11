import type React from 'react';

import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import {deriveTabKey} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {StepTitles} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';

// &amp; must be decoded last to avoid double-decoding (e.g. &amp;lt; → &lt; → <)
const HTML_ENTITIES: Array<[string, string]> = [
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#x27;', "'"],
  ['&#39;', "'"],
  ['&apos;', "'"],
  ['&#x2F;', '/'],
  ['&nbsp;', ' '],
  ['&amp;', '&'],
];

function decodeHtmlEntities(text: string): string {
  let result = text;
  // Decode named entities (except &amp;) first
  for (const [entity, char] of HTML_ENTITIES) {
    if (entity === '&amp;') {
      continue;
    }
    result = result.split(entity).join(char);
  }
  // Handle numeric entities like &#60; &#x3C; before &amp; to avoid
  // double-decoding (e.g. &amp;#60; → &#60; → <)
  result = result.replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(Number(dec)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  // Decode &amp; last
  result = result.split('&amp;').join('&');
  return result;
}

/**
 * Converts simple HTML to markdown. Only handles the subset of tags
 * that our onboarding components produce.
 */
export function simpleHtmlToMarkdown(html: string): string {
  let result = html;

  // Handle <br> / <br/> / <br /> tags
  result = result.replace(/<br\s*\/?>/gi, '\n');

  // Handle ordered lists - must come before generic tag stripping
  result = result.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match, inner: string) => {
    let index = 1;
    const items = inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, content: string) => {
      const line = `${index}. ${content.trim()}\n`;
      index++;
      return line;
    });
    // Strip any remaining whitespace-only text nodes between list items
    return items.replace(/^\s+$/gm, '') + '\n';
  });

  // Handle unordered lists
  result = result.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match, inner: string) => {
    const items = inner.replace(
      /<li[^>]*>([\s\S]*?)<\/li>/gi,
      (_m, content: string) => `- ${content.trim()}\n`
    );
    return items.replace(/^\s+$/gm, '') + '\n';
  });

  // Handle anchor tags
  result = result.replace(
    /<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href: string, text: string) => `[${text}](${href})`
  );

  // Handle bold
  result = result.replace(
    /<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/gi,
    (_match, text: string) => `**${text}**`
  );

  // Handle italic
  result = result.replace(
    /<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/gi,
    (_match, text: string) => `*${text}*`
  );

  // Handle <pre> blocks containing <code> (fenced code blocks from CodeBlock component)
  result = result.replace(
    /<pre[^>]*>\s*<code(?:\s+class="language-([^"]*)")?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_match, lang: string | undefined, code: string) => {
      const language = lang ?? '';
      return `\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n\n`;
    }
  );

  // Handle inline code
  result = result.replace(
    /<code>([\s\S]*?)<\/code>/gi,
    (_match, text: string) => `\`${text}\``
  );

  // Handle paragraphs
  result = result.replace(
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    (_match, text: string) => `${text.trim()}\n\n`
  );

  // Handle divs - convert to text with newline
  result = result.replace(
    /<div[^>]*>([\s\S]*?)<\/div>/gi,
    (_match, text: string) => `${text.trim()}\n`
  );

  // Strip all remaining HTML tags (loop to handle nested/malformed tags like <scr<script>ipt>)
  let previous = '';
  while (previous !== result) {
    previous = result;
    result = result.replace(/<[^>]+>/g, '');
  }

  // Decode HTML entities
  result = decodeHtmlEntities(result);

  return result.trim();
}

/**
 * Converts a React.ReactNode to a markdown-formatted string by walking
 * the element tree directly. Handles primitives, arrays, and React
 * elements with known HTML types (strong, em, code, a). Components
 * like ExternalLink are detected via href/to props.
 */
export function reactNodeToText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string') {
    return node;
  }
  if (typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(reactNodeToText).join('');
  }
  // React element — extract props and recurse into children
  if (typeof node === 'object' && 'props' in node) {
    const element = node as React.ReactElement;
    const props = element.props as Record<string, unknown>;
    const childText = reactNodeToText(props.children as React.ReactNode);
    const elementType = element.type;

    // Convert known HTML elements to markdown
    if (typeof elementType === 'string') {
      const rawHref = props.href ?? props.to;
      const href = typeof rawHref === 'string' ? rawHref : undefined;
      if ((elementType === 'a' || href) && href && childText) {
        return `[${childText}](${href})`;
      }
      if (elementType === 'strong' || elementType === 'b') {
        return `**${childText}**`;
      }
      if (elementType === 'em' || elementType === 'i') {
        return `*${childText}*`;
      }
      if (elementType === 'code') {
        return `\`${childText}\``;
      }
      return childText;
    }

    // Component elements (function/class) — check for href/to props
    // (handles components like ExternalLink that pass through href)
    const rawHref = props.href ?? props.to;
    const href = typeof rawHref === 'string' ? rawHref : undefined;
    if (href && childText) {
      return `[${childText}](${href})`;
    }

    return childText;
  }
  return '';
}

interface MarkdownOptions {
  authToken?: string;
  /**
   * Block path tracking the position within the content tree.
   * Built recursively: "1" for top-level block 1, "2_1" for block 1
   * inside conditional block 2. Set by stepsToMarkdown/contentBlockToMarkdown.
   */
  blockPath?: string;
  /**
   * Per-block tab selection. Used when calling contentBlockToMarkdown directly
   * (e.g. in tests). For full step conversion, use `tabSelectionsMap` instead.
   */
  selectedTabValue?: string;
  /**
   * Current step index, set internally by stepsToMarkdown when iterating.
   * Included in the tab key to disambiguate tabs with identical labels
   * across different steps.
   */
  stepIndex?: number;
  /**
   * Map of tab-key → selected value. Keys are derived from tab labels via
   * deriveTabKey. Obtained from useTabSelectionsMap() at click time.
   * Persists across component mount/unmount cycles.
   */
  tabSelectionsMap?: ReadonlyMap<string, string>;
}

const AUTH_TOKEN_PLACEHOLDER = '___ORG_AUTH_TOKEN___';

function replaceAuthToken(code: string, options?: MarkdownOptions): string {
  if (options?.authToken) {
    return code.replaceAll(AUTH_TOKEN_PLACEHOLDER, options.authToken);
  }
  return code;
}

function renderTabbedCodeBlock(
  tabs: Array<{code: string; label: string; language: string; filename?: string}>,
  selectedValue: string | undefined,
  options?: MarkdownOptions
): string {
  // value === label for content block tabs (set in defaultRenderers.tsx)
  const matchedTab = selectedValue
    ? tabs.find(tab => tab.label === selectedValue)
    : undefined;

  const tab = matchedTab ?? tabs[0]!;
  const filenameComment = tab.filename ? `// ${tab.filename}\n` : '';
  return replaceAuthToken(
    `\`\`\`${tab.language}\n${filenameComment}${tab.code}\n\`\`\``,
    options
  );
}

/**
 * Converts a single ContentBlock to markdown text.
 *
 * Tab selection is resolved by looking up the block's tab key in
 * options.tabSelectionsMap (from the scope), falling back to
 * options.selectedTabValue (for direct calls / tests).
 */
export function contentBlockToMarkdown(
  block: ContentBlock,
  options?: MarkdownOptions
): string {
  switch (block.type) {
    case 'text':
      return reactNodeToText(block.text);

    case 'code': {
      if ('tabs' in block) {
        if (block.tabs && block.tabs.length > 0) {
          const selectedValue =
            options?.tabSelectionsMap?.get(
              deriveTabKey(block.tabs, options?.stepIndex, options?.blockPath)
            ) ?? options?.selectedTabValue;
          return renderTabbedCodeBlock(block.tabs, selectedValue, options);
        }
        // MultipleCodeBlock with empty tabs — nothing to render
        return '';
      }
      // Single code block (SingleCodeBlock has code/language directly)
      const filenameComment = block.filename ? `// ${block.filename}\n` : '';
      return replaceAuthToken(
        `\`\`\`${block.language}\n${filenameComment}${block.code}\n\`\`\``,
        options
      );
    }

    case 'alert': {
      const alertLabel = block.alertType === 'warning' ? 'Warning' : 'Note';
      return `> **${alertLabel}:** ${reactNodeToText(block.text)}`;
    }

    case 'subheader':
      return `### ${reactNodeToText(block.text)}`;

    case 'list':
      return block.items.map(item => `- ${reactNodeToText(item)}`).join('\n');

    case 'conditional':
      if (!block.condition) {
        return '';
      }
      return block.content
        .map((b, childIndex) => {
          const childPath = options?.blockPath
            ? `${options.blockPath}_${childIndex}`
            : `${childIndex}`;
          return contentBlockToMarkdown(b, {...options, blockPath: childPath});
        })
        .filter(Boolean)
        .join('\n\n');

    case 'custom':
      return reactNodeToText(block.content);

    default:
      return '';
  }
}

function stepTitle(step: OnboardingStep): string {
  if (step.title) {
    return step.title;
  }
  if (step.type) {
    return StepTitles[step.type];
  }
  return 'Step';
}

/**
 * Converts an array of OnboardingStep objects to a markdown string.
 * Each step becomes a ## heading followed by its content blocks.
 */
export function stepsToMarkdown(
  steps: OnboardingStep[],
  options?: MarkdownOptions
): string {
  return steps
    .map((step, index) => {
      const heading = `## ${stepTitle(step)}`;
      const body = step.content
        .map((b, blockIndex) =>
          contentBlockToMarkdown(b, {
            ...options,
            stepIndex: index,
            blockPath: String(blockIndex),
          })
        )
        .filter(Boolean)
        .join('\n\n');
      return `${heading}\n\n${body}`;
    })
    .join('\n\n');
}
