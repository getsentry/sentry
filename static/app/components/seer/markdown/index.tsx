import type {ReactNode} from 'react';
import {createContext, Fragment, useContext} from 'react';
import {css} from '@emotion/react';
import * as Sentry from '@sentry/react';

import {Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Heading} from '@sentry/scraps/text';

import {STRUCTURED_SEER_EMBED_SCHEMAS} from './embeds/schemas';
import {SeerEmbedRegistry} from './embeds';

const ISSUE_SHORT_ID_PATTERN =
  /\b((?:[A-Z][A-Z0-9_]+|[0-9_]+[A-Z][A-Z0-9_]*)(?:-[A-Z0-9]+)+)\b/;

function LinkifyIssueShortIds({children}: {children: string}): ReactNode {
  const parts = children.split(ISSUE_SHORT_ID_PATTERN);
  if (parts.length === 1) {
    return children;
  }
  return (
    <Fragment>
      {parts.map((part, i) => {
        if (!part) {
          return null;
        }
        if (i % 2 === 1) {
          return (
            <Link key={i} to={`/issues/${part}/`}>
              {part}
            </Link>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  );
}

const IsInsideLinkContext = createContext(false);
const StructuredContentContext = createContext<Record<string, unknown> | null>(null);

function toRelativeHref(href: string): string {
  if (!/^https?:\/\//.test(href)) {
    return href;
  }
  const {origin} = window.location;
  if (href === origin || href.startsWith(`${origin}/`)) {
    return href.slice(origin.length) || '/';
  }
  return href;
}

/**
 * Markdown re-lexes and re-renders on every streamed chunk, so an unhandled tag
 * would otherwise report once per chunk. Report each tag only once per page load.
 */
const reportedUnhandledTags = new Set<string>();

function reportUnhandledTag(
  name: string,
  level: 'block' | 'inline',
  attrs: Record<string, string>
) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(`[Markdown] no renderer for tag: ${name}`, attrs);
    return;
  }

  if (reportedUnhandledTags.has(name)) {
    return;
  }
  reportedUnhandledTags.add(name);

  Sentry.withScope(scope => {
    scope.setLevel('warning');
    scope.setTag('markdown.tag', name);
    scope.setTag('markdown.tag_level', level);
    scope.setExtra('attrs', attrs);
    scope.setFingerprint(['markdown-unhandled-tag', name]);
    Sentry.captureException(new Error(`[Markdown] no renderer for tag: ${name}`));
  });
}

const SEER_EMBED_COMPONENTS: MarkdownProps['components'] = {
  Tag: function SeerTag({name, data, level, attrs}) {
    const structuredContent = useContext(StructuredContentContext);
    const Embed = SeerEmbedRegistry.get(name);
    if (Embed) {
      const embedData =
        name in STRUCTURED_SEER_EMBED_SCHEMAS
          ? structuredContent?.[name]
          : data === undefined
            ? structuredContent?.[name]
            : data;
      const embed = <Embed name={name} data={embedData} level={level} />;
      if (level === 'inline') {
        return embed;
      }
      return (
        <Container
          css={theme => css`
            &:last-child {
              margin-bottom: ${theme.space['2xl']};
            }
          `}
        >
          {embed}
        </Container>
      );
    }
    // Unknown embeds are expected to be registered here; drop them and report
    // instead of echoing plaintext like default Markdown.
    reportUnhandledTag(name, level, attrs);
    return null;
  },
  Link: ({children, Default, href, title}) => (
    <IsInsideLinkContext.Provider value>
      <Default href={toRelativeHref(href)} title={title}>
        {children}
      </Default>
    </IsInsideLinkContext.Provider>
  ),
  Text: function SeerText({children}) {
    const isInsideLink = useContext(IsInsideLinkContext);
    const text = children.replace(/^(?:#{1,6}\s*|`+|\*{1,3})/, '');
    if (!text) {
      return null;
    }
    if (isInsideLink) {
      return text;
    }
    return <LinkifyIssueShortIds>{text}</LinkifyIssueShortIds>;
  },
  InlineCode: function SeerInlineCode({children, Default}) {
    const isInsideLink = useContext(IsInsideLinkContext);
    if (isInsideLink) {
      return <Default>{children}</Default>;
    }
    const parts = children.split(ISSUE_SHORT_ID_PATTERN);
    if (parts.length === 3 && parts[1]) {
      return (
        <Link to={`/issues/${parts[1]}/`}>
          <Default>{children}</Default>
        </Link>
      );
    }
    return <Default>{children}</Default>;
  },
  Heading: ({children, level}) => (
    <Heading as={`h${level}`} size="lg">
      {children}
    </Heading>
  ),
};

export function SeerMarkdown({
  components,
  structuredContent = null,
  ...props
}: MarkdownProps & {
  structuredContent?: Record<string, unknown> | null;
}) {
  return (
    <StructuredContentContext.Provider value={structuredContent}>
      <Markdown {...props} components={{...SEER_EMBED_COMPONENTS, ...components}} />
    </StructuredContentContext.Provider>
  );
}
