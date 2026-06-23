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

export function Markdown({raw, components = {}, variant = 'static'}: MarkdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTextLensRef = useRef(new Map<number, number>());
  const isStreaming = variant === 'streaming';

  const tokens = useMemo(() => MarkedLexer.lex(raw), [raw]);

  const elements = useMemo(
    () =>
      tokens.map((token, i) => (
        <Token
          key={isStreaming ? `${i}:${token.raw.length}` : i}
          token={token as ExtendedToken}
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
    <Stack ref={containerRef} gap="lg" flex={1} style={{overflowWrap: 'break-word'}}>
      {isStreaming && <Global styles={streamingAnimationStyles} />}
      {elements}
    </Stack>
  );
}
