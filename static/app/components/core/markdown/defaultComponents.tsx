import type {ReactNode} from 'react';

import {CodeBlock, InlineCode} from '@sentry/scraps/code';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Quote} from '@sentry/scraps/quote';
import {Heading, Text} from '@sentry/scraps/text';

import {isSafeHref, sanitizeHtml} from 'sentry/utils/marked/marked';

export function DefaultParagraph({children}: {children: ReactNode}) {
  return (
    <Text as="p" size="md" density="comfortable">
      {children}
    </Text>
  );
}

export function DefaultHeading({
  children,
  level,
}: {
  children: ReactNode;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  return <Heading as={`h${level}`}>{children}</Heading>;
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
  if (!isSafeHref(href)) {
    return <span>{children}</span>;
  }
  if (href.startsWith('/')) {
    return (
      <Link to={href} title={title ?? undefined}>
        {children}
      </Link>
    );
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

export function DefaultHtmlBlock({html}: {html: string}) {
  return <span dangerouslySetInnerHTML={{__html: sanitizeHtml(html)}} />;
}
