import React, {useEffect, useRef, useState} from 'react';
import type {ComponentType, ReactNode} from 'react';

import {MarkedLexer} from 'sentry/utils/marked/marked';

import {renderToken} from './renderToken';

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
  Text: ComponentType<{children: string}>;
  UnorderedList: ComponentType<{children: ReactNode}>;
}>;

interface MarkdownProps {
  raw: string | AsyncIterable<string>;
  components?: MarkdownComponents;
}

export function Markdown({raw, components = {}}: MarkdownProps) {
  if (typeof raw === 'string') {
    return <StaticMarkdown raw={raw} components={components} />;
  }
  return <StreamingMarkdown raw={raw} components={components} />;
}

function StaticMarkdown({
  raw,
  components,
}: {
  components: MarkdownComponents;
  raw: string;
}) {
  const tokenCache = useRef(new Map<string, ReactNode>());
  const prevComponentsRef = useRef(components);

  if (prevComponentsRef.current !== components) {
    tokenCache.current.clear();
    prevComponentsRef.current = components;
  }

  const tokens = MarkedLexer.lex(raw);
  const elements: ReactNode[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const cached = tokenCache.current.get(token.raw);
    if (cached === undefined) {
      const el = renderToken(token, components, i);
      tokenCache.current.set(token.raw, el);
      elements.push(el);
    } else {
      elements.push(cached);
    }
  }

  // Evict stale cache entries
  const currentKeys = new Set(tokens.map(t => t.raw));
  for (const key of tokenCache.current.keys()) {
    if (!currentKeys.has(key)) {
      tokenCache.current.delete(key);
    }
  }

  return <React.Fragment>{elements}</React.Fragment>;
}

function splitAtLastBoundary(text: string): {
  pending: string;
  stable: string;
} {
  const boundary = text.lastIndexOf('\n\n');
  if (boundary === -1) {
    return {stable: '', pending: text};
  }
  return {
    stable: text.slice(0, boundary + 2),
    pending: text.slice(boundary + 2),
  };
}

function StreamingMarkdown({
  raw,
  components,
}: {
  components: MarkdownComponents;
  raw: AsyncIterable<string>;
}) {
  const [accumulated, setAccumulated] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let buffer = '';

    async function consume() {
      for await (const chunk of raw) {
        if (cancelled) {
          break;
        }
        buffer += chunk;
        setAccumulated(buffer);
      }
      if (!cancelled) {
        setIsComplete(true);
      }
    }

    consume();

    return () => {
      cancelled = true;
    };
  }, [raw]);

  if (isComplete) {
    return <StaticMarkdown raw={accumulated} components={components} />;
  }

  const {stable, pending} = splitAtLastBoundary(accumulated);

  return (
    <React.Fragment>
      {stable && <StaticMarkdown raw={stable} components={components} />}
      {pending && <span>{pending}</span>}
    </React.Fragment>
  );
}
