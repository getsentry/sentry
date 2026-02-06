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

  // Strip all remaining HTML tags
  result = result.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  result = decodeHtmlEntities(result);

  return result.trim();
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
    // Fallback: if renderToStaticMarkup fails, return empty string
    return '';
  }
}

/**
 * Converts a single ContentBlock to markdown text.
 */
export function contentBlockToMarkdown(block: ContentBlock): string {
  switch (block.type) {
    case 'text':
      return reactNodeToText(block.text);

    case 'code': {
      if ('tabs' in block && block.tabs) {
        return block.tabs
          .map(tab => {
            const header = tab.label
              ? `**${tab.label}**${tab.filename ? ` (${tab.filename})` : ''}\n\n`
              : '';
            return `${header}\`\`\`${tab.language}\n${tab.code}\n\`\`\``;
          })
          .join('\n\n');
      }
      // Single code block
      const singleBlock = block as Extract<ContentBlock, {type: 'code'}> & {
        code: string;
        language: string;
        filename?: string;
      };
      const filenameComment = singleBlock.filename ? `// ${singleBlock.filename}\n` : '';
      return `\`\`\`${singleBlock.language}\n${filenameComment}${singleBlock.code}\n\`\`\``;
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
      return block.content.map(contentBlockToMarkdown).filter(Boolean).join('\n\n');

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
export function stepsToMarkdown(steps: OnboardingStep[]): string {
  return steps
    .map(step => {
      const heading = `## ${stepTitle(step)}`;
      const body = step.content.map(contentBlockToMarkdown).filter(Boolean).join('\n\n');
      return `${heading}\n\n${body}`;
    })
    .join('\n\n');
}

/**
 * Strips markdown formatting from text while preserving code blocks as-is.
 */
function stripMarkdownFormatting(markdown: string): string {
  // Extract code blocks and replace with placeholders
  const codeBlocks: string[] = [];
  let result = markdown.replace(/```[\s\S]*?```/g, match => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Strip inline code backticks (but keep content)
  result = result.replace(/`([^`]+)`/g, '$1');

  // Strip bold
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');

  // Strip italic
  result = result.replace(/\*([^*]+)\*/g, '$1');

  // Convert markdown links to just text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Strip heading markers
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Strip blockquote markers
  result = result.replace(/^>\s*/gm, '');

  // Restore code blocks
  result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_match, index) => {
    return codeBlocks[Number(index)] ?? '';
  });

  return result;
}

/**
 * Converts an array of OnboardingStep objects to plain text.
 * Same as stepsToMarkdown but with markdown formatting stripped.
 * Code blocks are preserved as-is.
 */
export function stepsToText(steps: OnboardingStep[]): string {
  const markdown = stepsToMarkdown(steps);
  return stripMarkdownFormatting(markdown);
}
