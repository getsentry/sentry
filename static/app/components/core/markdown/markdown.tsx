import {useLayoutEffect, useMemo, useRef} from 'react';
import type {ComponentType, ReactNode} from 'react';
import {Global} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';

import type {MarkedToken} from 'sentry/utils/marked/marked';
import {MarkedLexer} from 'sentry/utils/marked/marked';

import {Token} from './token';
import {streamingAnimationStyles, useStreamingAnimation} from './useStreamingAnimation';

export type MarkdownComponents = Partial<{
  Blockquote: ComponentType<{children: ReactNode}>;
  CodeBlock: ComponentType<{children: string; lang?: string}>;
  Emphasis: ComponentType<{children: ReactNode}>;
  Heading: ComponentType<{children: ReactNode; level: 1 | 2 | 3 | 4 | 5 | 6}>;
  HorizontalRule: ComponentType<Record<PropertyKey, unknown>>;
  Html: ComponentType<{html: string}>;
  Image: ComponentType<{src: string; alt?: string; title?: string | null}>;
  InlineCode: ComponentType<{children: string}>;
  LineBreak: ComponentType<Record<PropertyKey, unknown>>;
  Link: ComponentType<{children: ReactNode; href: string; title?: string | null}>;
  ListItem: ComponentType<{children: ReactNode; checked?: boolean}>;
  OrderedList: ComponentType<{children: ReactNode}>;
  Paragraph: ComponentType<{children: ReactNode}>;
  Strikethrough: ComponentType<{children: ReactNode}>;
  Strong: ComponentType<{children: ReactNode}>;
  Table: ComponentType<{children: ReactNode}>;
  TableBody: ComponentType<{children: ReactNode}>;
  TableCell: ComponentType<{children: ReactNode; align?: string | null}>;
  TableHead: ComponentType<{children: ReactNode}>;
  TableHeaderCell: ComponentType<{children: ReactNode; align?: string | null}>;
  TableRow: ComponentType<{children: ReactNode}>;
  TaskList: ComponentType<{children: ReactNode}>;
  TaskListItem: ComponentType<{checked: boolean; children: ReactNode}>;
  Text: ComponentType<{children: string}>;
  UnorderedList: ComponentType<{children: ReactNode}>;
}>;

interface MarkdownProps {
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
          token={token as MarkedToken}
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
    <Stack ref={containerRef} gap="lg" flex={1} maxWidth="72ch">
      {isStreaming && <Global styles={streamingAnimationStyles} />}
      {elements}
    </Stack>
  );
}
