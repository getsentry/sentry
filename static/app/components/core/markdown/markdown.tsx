import {useMemo} from 'react';
import type {ComponentType, ReactNode} from 'react';

import {Stack} from '@sentry/scraps/layout';

import type {MarkedToken} from 'sentry/utils/marked/marked';
import {MarkedLexer} from 'sentry/utils/marked/marked';

import {Token} from './token';

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
  raw: string;
  components?: MarkdownComponents;
}

export function Markdown({raw, components = {}}: MarkdownProps) {
  const elements = useMemo(() => {
    const tokens = MarkedLexer.lex(raw);
    return tokens.map((token, i) => (
      <Token key={i} token={token as MarkedToken} components={components} />
    ));
  }, [raw, components]);

  return (
    <Stack gap="lg" flex={1} maxWidth="72ch">
      {elements}
    </Stack>
  );
}
