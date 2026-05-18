import {type ReactNode} from 'react';
import styled from '@emotion/styled';

import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Quote} from '@sentry/scraps/quote';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {isSafeHref, isInternalHref} from 'sentry/utils/marked/marked';

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
  return (
    <CodeBlock dark language={lang}>
      {children}
    </CodeBlock>
  );
}

export function DefaultHtmlBlock({html}: {html: string}) {
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

export function DefaultListItem({children}: {children: ReactNode; checked?: boolean}) {
  return <Container as="li">{children}</Container>;
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

export function DefaultLineBreak() {
  return <br />;
}

export const DefaultTable = styled('table')`
  width: 100%;
  border-collapse: collapse;
  border-radius: ${p => p.theme.radius.md};
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: 0 0 0 1px ${p => p.theme.tokens.border.primary};
  overflow: hidden;
`;

export const DefaultTableHead = styled('thead')`
  background: ${p => p.theme.tokens.background.tertiary};
  border-bottom: 4px solid ${p => p.theme.tokens.border.primary};
`;

export const DefaultTableBody = styled('tbody')`
  background: ${p => p.theme.tokens.background.primary};
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
`;

export const DefaultTableRow = styled('tr')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  vertical-align: baseline;

  &:last-child {
    border-bottom: 0;
    border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  }
`;

export const DefaultTableHeaderCell = styled('th')<{align?: string | null}>`
  padding-inline: ${p => p.theme.space.xl};
  padding-block: ${p => p.theme.space.sm};
  text-align: ${p => p.align ?? 'left'};

  &:first-of-type {
    border-radius: ${p => p.theme.radius.md} 0 0 0;
  }
  &:last-of-type {
    border-radius: 0 ${p => p.theme.radius.md} 0 0;
  }
`;

export const DefaultTableCell = styled('td')<{align?: string | null}>`
  padding-inline: ${p => p.theme.space.xl};
  padding-block: ${p => p.theme.space.lg};
  text-align: ${p => p.align ?? 'left'};
`;
