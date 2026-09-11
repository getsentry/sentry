import {useLayoutEffect, useMemo, useRef} from 'react';
import type {ComponentType, ReactNode} from 'react';
import {Global} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';

import type {ExtendedToken} from 'sentry/utils/marked/marked';
import {MarkedLexer} from 'sentry/utils/marked/marked';

import {Token} from './token';
import {streamingAnimationStyles, useStreamingAnimation} from './useStreamingAnimation';

type WithDefault<Props> = Props & {Default: ComponentType<Props>};

export type MarkdownComponents = Partial<{
  Blockquote: ComponentType<WithDefault<{children: ReactNode}>>;
  CodeBlock: ComponentType<WithDefault<{children: string; lang?: string}>>;
  Emphasis: ComponentType<WithDefault<{children: ReactNode}>>;
  Heading: ComponentType<
    WithDefault<{children: ReactNode; level: 1 | 2 | 3 | 4 | 5 | 6}>
  >;
  HorizontalRule: ComponentType<WithDefault<Record<PropertyKey, unknown>>>;
  Html: ComponentType<WithDefault<{html: string}>>;
  Image: ComponentType<{src: string; alt?: string; title?: string | null}>;
  InlineCode: ComponentType<WithDefault<{children: string}>>;
  LineBreak: ComponentType<WithDefault<Record<PropertyKey, unknown>>>;
  Link: ComponentType<
    WithDefault<{children: ReactNode; href: string; title?: string | null}>
  >;
  ListItem: ComponentType<WithDefault<{children: ReactNode; checked?: boolean}>>;
  OrderedList: ComponentType<WithDefault<{children: ReactNode}>>;
  Paragraph: ComponentType<WithDefault<{children: ReactNode}>>;
  Strikethrough: ComponentType<WithDefault<{children: ReactNode}>>;
  Strong: ComponentType<WithDefault<{children: ReactNode}>>;
  Table: ComponentType<WithDefault<{children: ReactNode}>>;
  TableBody: ComponentType<WithDefault<{children: ReactNode}>>;
  TableCell: ComponentType<
    WithDefault<{children: ReactNode; align?: 'left' | 'right' | 'center'}>
  >;
  TableHead: ComponentType<WithDefault<{children: ReactNode}>>;
  TableHeaderCell: ComponentType<
    WithDefault<{children: ReactNode; align?: 'left' | 'right' | 'center'}>
  >;
  TableRow: ComponentType<WithDefault<{children: ReactNode}>>;
  Tag: ComponentType<
    WithDefault<{
      attrs: Record<string, string>;
      data: unknown;
      level: 'block' | 'inline';
      name: string;
      /** Original `{% tag %}` source, including body and closing tag. */
      raw: string;
      /**
       * Position of this tag among all tags in the message, in document order.
       * Counts tags only, so two inline tags in one paragraph get 0 and 1.
       */
      index?: number;
    }>
  >;
  TaskList: ComponentType<WithDefault<{children: ReactNode}>>;
  TaskListItem: ComponentType<WithDefault<{checked: boolean; children: ReactNode}>>;
  Text: ComponentType<WithDefault<{children: string}>>;
  UnorderedList: ComponentType<WithDefault<{children: ReactNode}>>;
}>;

export interface MarkdownProps {
  raw: string;
  components?: MarkdownComponents;
  variant?: 'static' | 'streaming';
}

/**
 * Stamps every tag token with its position among all tags in the message, in
 * document order.
 *
 * Runs after lexing rather than inside the tokenizer because marked defers
 * inline tokenization to a second pass: a tokenizer counter would number an
 * inline tag in the first paragraph after a block tag in the second.
 *
 * The result is stable while streaming. Content only ever grows by appending,
 * so a newly closed tag can only appear after the existing ones and never
 * shifts their index -- and a tag whose closing marker has not arrived yet is
 * not a tag token at all, so it claims no index early.
 */
function assignTagIndexes(tokens: ExtendedToken[]): void {
  let nextIndex = 0;

  function visitAll(list: readonly ExtendedToken[]): void {
    for (const token of list) {
      visit(token);
    }
  }

  function visit(token: ExtendedToken): void {
    if (token.type === 'tag') {
      // A tag body is JSON, never markdown, so it has no child tokens.
      token.index = nextIndex++;
      return;
    }
    if ('tokens' in token && token.tokens) {
      visitAll(token.tokens as ExtendedToken[]);
    }
    if ('items' in token && token.items) {
      visitAll(token.items as ExtendedToken[]);
    }
    // Tables hold their cells outside `tokens`; header precedes rows on screen.
    if ('header' in token && token.header) {
      for (const cell of token.header) {
        visitAll(cell.tokens as ExtendedToken[]);
      }
    }
    if ('rows' in token && token.rows) {
      for (const row of token.rows) {
        for (const cell of row) {
          visitAll(cell.tokens as ExtendedToken[]);
        }
      }
    }
  }

  visitAll(tokens);
}

export function Markdown({raw, components = {}, variant = 'static'}: MarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTextLensRef = useRef(new Map<number, number>());
  const isStreaming = variant === 'streaming';

  const tokens = useMemo(() => {
    const lexed = MarkedLexer.lex(raw) as ExtendedToken[];
    assignTagIndexes(lexed);
    return lexed;
  }, [raw]);

  const elements = useMemo(
    () =>
      tokens.map((token, i) => (
        <Token
          key={isStreaming ? `${i}:${token.raw.length}` : i}
          token={token}
          components={components}
        />
      )),
    [tokens, components, isStreaming]
  );

  useStreamingAnimation(containerRef, isStreaming);

  useLayoutEffect(() => {
    if (!isStreaming) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const children = Array.from(container.children);
    const nextLens = new Map<number, number>();
    let changed = false;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!(child instanceof HTMLElement)) {
        continue;
      }
      const len = (child.textContent ?? '').length;
      const prevLen = prevTextLensRef.current.get(i) ?? 0;
      if (prevLen > 0) {
        child.dataset.skip = String(prevLen);
      }
      if (len !== prevLen) {
        changed = true;
      }
      nextLens.set(i, len);
    }

    if (changed) {
      prevTextLensRef.current = nextLens;
    }
  }, [isStreaming, elements]);

  return (
    <Stack
      ref={containerRef}
      gap="lg"
      flex={1}
      style={{overflowWrap: 'break-word'}}
      data-streaming={isStreaming || undefined}
    >
      {isStreaming && <Global styles={streamingAnimationStyles} />}
      {elements}
    </Stack>
  );
}
