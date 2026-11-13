import {Marked, type Token} from 'marked'; // eslint-disable-line no-restricted-imports -- This codec lexes source without rendering HTML.
import {z} from 'zod';

import {blockTagExtension, inlineTagExtension} from '@sentry/scraps/markdown/tag';

import {
  documentBlockSchema,
  documentInlineSchema,
  EMPTY_DOCUMENT,
  parseComposerDocument,
  type ComposerDocument,
  type DocumentBlock,
  type DocumentInline,
  type DocumentMark,
} from './model';

const markdown = new Marked({extensions: [blockTagExtension, inlineTagExtension]});
const tagSchema = z.object({
  name: z.string(),
  attrs: z.record(z.string(), z.string()),
  data: z.unknown(),
});

function readTag(token: Token): unknown {
  const tag = tagSchema.safeParse(token);
  if (!tag.success || Object.keys(tag.data.attrs).length > 0) {
    return undefined;
  }
  const {name, data} = tag.data;
  if (name !== 'mention' && name !== 'reference' && name !== 'attachment') {
    return undefined;
  }
  const node = documentInlineSchema.safeParse(data);
  if (node.success && node.data.type === name) {
    return node.data;
  }
  const block = documentBlockSchema.safeParse(data);
  return block.success && block.data.type === name ? block.data : undefined;
}

function readInline(
  tokens: Token[] | undefined,
  marks: readonly DocumentMark[] = []
): DocumentInline[] | null {
  if (!tokens) {
    return null;
  }
  const children: DocumentInline[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        if (token.tokens) {
          const nested = readInline(token.tokens, marks);
          if (!nested) {
            return null;
          }
          children.push(...nested);
        } else {
          children.push({type: 'text', text: token.text, marks});
        }
        break;
      case 'escape':
        children.push({type: 'text', text: token.text, marks});
        break;
      case 'br':
        children.push({type: 'text', text: '\n', marks});
        break;
      case 'strong':
      case 'em':
      case 'del': {
        const mark =
          token.type === 'strong' ? 'bold' : token.type === 'em' ? 'italic' : 'strike';
        const nested = readInline(token.tokens, [...marks, mark]);
        if (!nested) {
          return null;
        }
        children.push(...nested);
        break;
      }
      case 'codespan':
        children.push({type: 'text', text: token.text, marks: [...marks, 'code']});
        break;
      case 'tag': {
        const node = documentInlineSchema.safeParse(readTag(token));
        if (!node.success || marks.length > 0) {
          return null;
        }
        children.push(node.data);
        break;
      }
      default:
        return null;
    }
  }
  return children;
}

function raw(source: string): ComposerDocument {
  return {version: 1, blocks: [{type: 'rawMarkdown', source}]};
}

export function documentFromMarkdown(source: string): ComposerDocument {
  if (source === '') {
    return EMPTY_DOCUMENT;
  }
  // shortcut: CRLF source stays opaque until the editor codec tracks original source spans.
  if (source.includes('\r')) {
    return raw(source);
  }
  const blocks: DocumentBlock[] = [];
  for (const token of markdown.lexer(source)) {
    if (token.type === 'space') {
      continue;
    }
    if (token.type === 'tag') {
      const data = readTag(token);
      const block = documentBlockSchema.safeParse(data);
      if (block.success) {
        blocks.push(block.data);
        continue;
      }
      const inline = documentInlineSchema.safeParse(data);
      if (inline.success) {
        blocks.push({type: 'paragraph', children: [inline.data]});
        continue;
      }
    }
    if (token.type === 'code' && token.codeBlockStyle !== 'indented') {
      blocks.push({type: 'codeBlock', text: token.text, language: token.lang ?? ''});
      continue;
    }
    if (token.type === 'paragraph') {
      const children = readInline(token.tokens);
      if (children) {
        blocks.push({type: 'paragraph', children});
        continue;
      }
    }
    if (token.type === 'blockquote') {
      const paragraphs = (token.tokens ?? []).filter(child => child.type !== 'space');
      if (paragraphs.length === 1 && paragraphs[0]?.type === 'paragraph') {
        const children = readInline(paragraphs[0].tokens);
        if (children) {
          blocks.push({type: 'quote', children});
          continue;
        }
      }
    }
    return raw(source);
  }
  return blocks.length > 0 ? parseComposerDocument({version: 1, blocks}) : raw(source);
}

function tag(name: string, data: unknown): string {
  // A closing-tag string inside JSON must not terminate its enclosing tag.
  const body = JSON.stringify(data).replaceAll('{%', '\\u007b%');
  return `{% ${name} %}${body}{% /${name} %}`;
}

function escapeText(text: string): string {
  return text.replace(/[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/g, '\\$&');
}

function inlineToMarkdown(node: DocumentInline): string {
  if (node.type !== 'text') {
    return tag(node.type, node);
  }
  let text = escapeText(node.text);
  if (node.marks.includes('code')) {
    const longestRun = Math.max(
      0,
      ...(node.text.match(/`+/g) ?? []).map(run => run.length)
    );
    const fence = '`'.repeat(longestRun + 1);
    text = `${fence} ${node.text} ${fence}`;
  }
  if (node.marks.includes('strike')) {
    text = `~~${text}~~`;
  }
  if (node.marks.includes('italic')) {
    text = `*${text}*`;
  }
  if (node.marks.includes('bold')) {
    text = `**${text}**`;
  }
  return text;
}

function blockToMarkdown(block: DocumentBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.children.map(inlineToMarkdown).join('');
    case 'quote':
      return block.children
        .map(inlineToMarkdown)
        .join('')
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
    case 'codeBlock': {
      const longestRun = Math.max(
        2,
        ...(block.text.match(/`+/g) ?? []).map(run => run.length)
      );
      const fence = '`'.repeat(longestRun + 1);
      return `${fence}${block.language}\n${block.text}\n${fence}`;
    }
    case 'attachment':
      return tag('attachment', block);
    case 'rawMarkdown':
      return block.source;
  }
}

export function documentToMarkdown(document: ComposerDocument): string {
  const normalized = parseComposerDocument(document);
  const source = normalized.blocks.map(blockToMarkdown).join('\n\n');
  const restored = documentFromMarkdown(source);
  if (JSON.stringify(restored) !== JSON.stringify(normalized)) {
    throw new Error(
      'The spike Markdown codec cannot represent this document losslessly. Marked whitespace or empty block boundaries may need the structured format.'
    );
  }
  return source;
}

export function documentToPlainText(document: ComposerDocument): string {
  return document.blocks
    .map(block => {
      switch (block.type) {
        case 'paragraph':
        case 'quote':
          return block.children
            .map(node => (node.type === 'text' ? node.text : node.label))
            .join('');
        case 'codeBlock':
          return block.text;
        case 'attachment':
          return block.name;
        case 'rawMarkdown':
          return block.source;
      }
    })
    .join('\n\n');
}
