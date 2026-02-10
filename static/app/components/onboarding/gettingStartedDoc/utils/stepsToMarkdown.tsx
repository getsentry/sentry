import type React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&apos;': "'",
  '&#x2F;': '/',
  '&nbsp;': ' ',
};

function decodeHtmlEntities(text: string): string {
  let result = text;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.split(entity).join(char);
  }
  // Handle numeric entities like &#60; &#x3C;
  result = result.replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(Number(dec)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
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
      return `\`\`\`${language}\n${code.trim()}\n\`\`\``;
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
 * Walks a React element tree and extracts text content directly from props.
 * Handles link elements (href/to props) by converting them to markdown links.
 * Used as a fallback when renderToStaticMarkup fails (e.g. components that
 * require router context like <Link>).
 */
function extractTextFromReactNode(node: React.ReactNode): string {
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
    return node.map(extractTextFromReactNode).join('');
  }
  // React element — extract props and recurse into children
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as React.ReactElement).props as Record<string, unknown>;
    const childText = extractTextFromReactNode(props.children as React.ReactNode);

    // Convert link elements to markdown links
    const href = (props.href ?? props.to) as string | undefined;
    if (href && childText) {
      return `[${childText}](${href})`;
    }

    return childText;
  }
  return '';
}

/**
 * Converts a React.ReactNode to a markdown string.
 * Handles primitives directly and uses renderToStaticMarkup for React elements.
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

  try {
    const html = renderToStaticMarkup(node as React.ReactElement);
    return simpleHtmlToMarkdown(html);
  } catch {
    // Fallback: walk the element tree directly when renderToStaticMarkup fails
    // (e.g. components needing router context like <Link>)
    return extractTextFromReactNode(node);
  }
}

interface MarkdownOptions {
  authToken?: string;
  selectedTabLabel?: string;
}

const AUTH_TOKEN_PLACEHOLDER = '___ORG_AUTH_TOKEN___';

function replaceAuthToken(code: string, options?: MarkdownOptions): string {
  if (options?.authToken) {
    return code.replaceAll(AUTH_TOKEN_PLACEHOLDER, options.authToken);
  }
  return code;
}

/**
 * Converts a single ContentBlock to markdown text.
 */
export function contentBlockToMarkdown(
  block: ContentBlock,
  options?: MarkdownOptions
): string {
  switch (block.type) {
    case 'text':
      return reactNodeToText(block.text);

    case 'code': {
      if ('tabs' in block && block.tabs) {
        // If a specific tab is selected, output only that tab
        const matchedTab = options?.selectedTabLabel
          ? block.tabs.find(tab => tab.label === options.selectedTabLabel)
          : undefined;

        if (matchedTab) {
          const filenameComment = matchedTab.filename
            ? `// ${matchedTab.filename}\n`
            : '';
          return replaceAuthToken(
            `\`\`\`${matchedTab.language}\n${filenameComment}${matchedTab.code}\n\`\`\``,
            options
          );
        }

        // Default: output only the first tab (what the user sees by default)
        const firstTab = block.tabs[0]!;
        const filenameComment = firstTab.filename ? `// ${firstTab.filename}\n` : '';
        return replaceAuthToken(
          `\`\`\`${firstTab.language}\n${filenameComment}${firstTab.code}\n\`\`\``,
          options
        );
      }
      // Single code block
      const singleBlock = block as Extract<ContentBlock, {type: 'code'}> & {
        code: string;
        language: string;
        filename?: string;
      };
      const filenameComment = singleBlock.filename ? `// ${singleBlock.filename}\n` : '';
      return replaceAuthToken(
        `\`\`\`${singleBlock.language}\n${filenameComment}${singleBlock.code}\n\`\`\``,
        options
      );
    }

    case 'alert':
      return `> **Note:** ${reactNodeToText(block.text)}`;

    case 'subheader':
      return `### ${reactNodeToText(block.text)}`;

    case 'list':
      return block.items.map(item => `- ${reactNodeToText(item)}`).join('\n');

    case 'conditional':
      if (!block.condition) {
        return '';
      }
      return block.content
        .map(b => contentBlockToMarkdown(b, options))
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
    // Capitalize the step type enum value
    const typeStr = step.type as string;
    return typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
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
    .map(step => {
      const heading = `## ${stepTitle(step)}`;
      const body = step.content
        .map(b => contentBlockToMarkdown(b, options))
        .filter(Boolean)
        .join('\n\n');
      return `${heading}\n\n${body}`;
    })
    .join('\n\n');
}
