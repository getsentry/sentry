import type {ReactNode} from 'react';
import {createContext, Fragment, useContext} from 'react';

import {Link} from '@sentry/scraps/link';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Heading} from '@sentry/scraps/text';

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

const SEER_EMBED_COMPONENTS: MarkdownProps['components'] = {
  Tag: ({name, data, level, Default, ...rest}) => {
    const Embed = SeerEmbedRegistry.get(name);
    if (Embed) {
      return <Embed name={name} data={data} level={level} />;
    }
    return <Default name={name} data={data} level={level} {...rest} />;
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

export function SeerMarkdown(props: Omit<MarkdownProps, 'components'>) {
  return <Markdown {...props} components={SEER_EMBED_COMPONENTS} />;
}
