import type {ComponentType, ReactNode} from 'react';
import {css} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import {
  IconChat,
  IconCode,
  IconCompass,
  IconDashboard,
  IconDocs,
  IconFire,
  IconIssues,
  IconList,
  IconPlay,
  IconProfiling,
  IconSiren,
  IconSpan,
  IconTable,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {isSafeHref} from 'sentry/utils/marked/marked';
import {safeURL} from 'sentry/utils/url/safeURL';

/**
 * Every data type Seer surfaces as a resource link
 */
export type ResourceKind =
  | 'conversation'
  | 'log'
  | 'trace'
  | 'profiling'
  | 'span'
  | 'error'
  | 'issue'
  | 'query'
  | 'metrics'
  | 'monitor'
  | 'replay'
  | 'docs'
  | 'code'
  | 'dashboard';

export const RESOURCE_KIND_ICON: Record<ResourceKind, ComponentType<SVGIconProps>> = {
  conversation: IconChat,
  log: IconList,
  trace: IconSpan,
  profiling: IconProfiling,
  span: IconSpan,
  error: IconFire,
  issue: IconIssues,
  query: IconCompass,
  metrics: IconTable,
  monitor: IconSiren,
  replay: IconPlay,
  docs: IconDocs,
  code: IconCode,
  dashboard: IconDashboard,
};

/**
 * Which output a resource link produces. `markdown` is the clipboard pass --
 * see `SeerEmbedRenderLevel`. Both come out of this one component so a copied
 * link can never point somewhere the rendered link does not.
 */
export type ResourceLinkFormat = 'element' | 'markdown';

/**
 * Mixed into every `*Link` wrapper, so the level an embed was asked to render
 * at reaches the `ResourceLink` at the bottom without each wrapper restating
 * what the prop means.
 */
export interface ResourceLinkFormatProps {
  format?: ResourceLinkFormat;
}

interface ResolvedHref {
  /** Where the link points, as the rendered anchor navigates. */
  href: string;
  isExternal: boolean;
}

/**
 * Seer writes hrefs into the tag body, so only a recognised shape is rendered:
 * an absolute http(s) URL that passes the markdown safety check, or a
 * site-relative path. Anything else -- a `javascript:` URL, a protocol-relative
 * `//host` that would leave the site without looking like it -- renders nothing
 * at every format.
 */
function resolveResourceHref(href: string): ResolvedHref | null {
  if (/^https?:\/\//.test(href) && isSafeHref(href)) {
    const parsed = safeURL(href);
    if (!parsed) {
      return null;
    }
    if (parsed.origin !== window.location.origin) {
      return {href, isExternal: true};
    }
    return {href: parsed.pathname + parsed.search + parsed.hash, isExternal: false};
  }

  if (/^\/[^/]/.test(href)) {
    return {href, isExternal: false};
  }

  return null;
}

/** A `]` or a backslash in a title would end the link text early. */
function escapeLinkText(title: string): string {
  return title.replace(/[\\[\]]/g, '\\$&');
}

/** Whitespace and parentheses in a destination need the angle-bracket form. */
function encodeLinkDestination(href: string): string {
  return /[\s()]/.test(href) ? `<${href}>` : href;
}

/**
 * The markdown form of a resource link, for the embeds that can build their own
 * href without a hook. Returns null for the same hrefs `ResourceLink` refuses.
 *
 * The destination is absolute because copied markdown is read outside the app --
 * pasted into a ticket, a chat, a commit message -- where a site-relative path
 * resolves against whatever page it landed on.
 */
export function resourceLinkMarkdown(href: string, title: string): string | null {
  const resolved = resolveResourceHref(href);
  if (!resolved) {
    return null;
  }

  const destination = resolved.isExternal
    ? resolved.href
    : window.location.origin + resolved.href;

  return `[${escapeLinkText(title)}](${encodeLinkDestination(destination)})`;
}

export function ResourceLink({
  icon: Icon,
  href,
  title,
  format = 'element',
}: {
  href: string;
  icon: ComponentType<SVGIconProps>;
  title: string;
  format?: ResourceLinkFormat;
}): ReactNode {
  const resolved = resolveResourceHref(href);
  if (!resolved) {
    return null;
  }

  if (format === 'markdown') {
    return resourceLinkMarkdown(href, title);
  }

  const icon = (
    <Flex
      as="span"
      align="center"
      display="inline-flex"
      height="1em"
      css={css`
        vertical-align: text-bottom;
      `}
    >
      <Icon size="xs" />
    </Flex>
  );

  if (resolved.isExternal) {
    return (
      <ExternalLink href={resolved.href}>
        {icon} {title}
      </ExternalLink>
    );
  }

  return (
    <Link to={resolved.href}>
      {icon} {title}
    </Link>
  );
}
