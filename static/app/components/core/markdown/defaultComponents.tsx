import {Fragment, type ReactNode} from 'react';

import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Quote} from '@sentry/scraps/quote';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {COLUMN_ALIGN_JUSTIFY} from 'sentry/components/tables/sortableHeaderCell';

import type {MarkdownTableColumn} from './markdown';
import {isSafeHref, isInternalHref} from './marked';

export function DefaultParagraph({children}: {children: ReactNode}) {
  return (
    <Text as="p" size="md" density="comfortable">
      {children}
    </Text>
  );
}

const DEFAULT_HEADING_SIZE = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs'] as const;

export function DefaultHeading({
  children,
  level,
}: {
  children: ReactNode;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  return (
    <Heading as={`h${level}`} size={DEFAULT_HEADING_SIZE[level - 1] ?? 'lg'}>
      {children}
    </Heading>
  );
}

export function DefaultBlockquote({children}: {children: ReactNode}) {
  return <Quote>{children}</Quote>;
}

export function DefaultInlineCode({children}: {children: string}) {
  return <InlineCode variant="neutral">{children}</InlineCode>;
}

export function DefaultLink({
  href,
  title,
  children,
}: {
  children: ReactNode;
  href: string;
  title?: string | null;
}) {
  if (isInternalHref(href)) {
    return (
      <Link to={href} title={title ?? undefined}>
        {children}
      </Link>
    );
  }
  if (!isSafeHref(href)) {
    return <span>{children}</span>;
  }
  return (
    <ExternalLink href={href} title={title ?? undefined}>
      {children}
    </ExternalLink>
  );
}

export function DefaultCodeBlock({children, lang}: {children: string; lang?: string}) {
  return <CodeBlock language={lang}>{children}</CodeBlock>;
}

export function DefaultHtmlBlock({html}: {html: TrustedHTML}) {
  return <span dangerouslySetInnerHTML={{__html: html}} />;
}

export function DefaultStrong({children}: {children: ReactNode}) {
  return <strong>{children}</strong>;
}

export function DefaultEmphasis({children}: {children: ReactNode}) {
  return <em>{children}</em>;
}

export function DefaultStrikethrough({children}: {children: ReactNode}) {
  return <Text strikethrough>{children}</Text>;
}

export function DefaultUnorderedList({children}: {children: ReactNode}) {
  return (
    <Stack as="ul" gap="sm" margin="0" role="list" style={{listStyle: 'disc'}}>
      {children}
    </Stack>
  );
}

export function DefaultOrderedList({children}: {children: ReactNode}) {
  return (
    <Stack as="ol" gap="sm" margin="0" role="list" style={{listStyle: 'decimal'}}>
      {children}
    </Stack>
  );
}

export function DefaultListItem({children}: {children: ReactNode}) {
  // Match DefaultParagraph so tight list items (inline-only content, no nested
  // <p>) keep md body size instead of inheriting a smaller parent size.
  return (
    <Text size="md" density="comfortable">
      {textProps => <li {...textProps}>{children}</li>}
    </Text>
  );
}

export function DefaultTaskList({children}: {children: ReactNode}) {
  return (
    <Stack
      as="ul"
      gap="sm"
      margin="0"
      padding="0"
      role="list"
      style={{listStyle: 'none'}}
    >
      {children}
    </Stack>
  );
}

export function DefaultTaskListItem({
  children,
  checked,
}: {
  checked: boolean;
  children: ReactNode;
}) {
  return (
    <Flex
      as="li"
      gap="sm"
      align="center"
      style={checked ? {textDecoration: 'line-through'} : undefined}
    >
      {children}
    </Flex>
  );
}

export function DefaultHorizontalRule() {
  return <Separator orientation="horizontal" />;
}

export function DefaultText({children}: {children: string}) {
  return <Fragment>{children}</Fragment>;
}

export function DefaultLineBreak() {
  return <br />;
}

export function DefaultTable({
  columns,
  header,
  rows,
}: {
  columns: MarkdownTableColumn[];
  header: ReactNode[];
  rows: ReactNode[][];
}) {
  return (
    <SimpleTable
      scrollable
      columns={columns.map((_, index) => ({
        key: String(index),
        width: 'minmax(min-content, auto)',
      }))}
      header={
        <SimpleTable.HeaderRow>
          {header.map((cell, index) => (
            <SimpleTable.HeaderCell key={index} align={columns[index]?.align}>
              {cell}
            </SimpleTable.HeaderCell>
          ))}
        </SimpleTable.HeaderRow>
      }
    >
      {rows.map((row, rowIndex) => (
        <SimpleTable.Row key={rowIndex}>
          {row.map((cell, cellIndex) => {
            const align = columns[cellIndex]?.align ?? 'left';
            return (
              <SimpleTable.RowCell
                key={cellIndex}
                alignSelf="baseline"
                justify={COLUMN_ALIGN_JUSTIFY[align]}
              >
                <Text align={align} variant="inherit">
                  {cell}
                </Text>
              </SimpleTable.RowCell>
            );
          })}
        </SimpleTable.Row>
      ))}
    </SimpleTable>
  );
}

/**
 * Fallback for `{% tag %}` tokens that no `components.Tag` renderer handled.
 * Echo the original source so plain Markdown consumers keep the content visible.
 * Surfaces that expect registered embeds (e.g. SeerMarkdown) should override Tag
 * to drop unknowns and report them instead.
 */
export function DefaultTag({raw}: {raw: string}) {
  return raw;
}
