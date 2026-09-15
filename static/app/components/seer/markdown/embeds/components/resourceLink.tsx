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
 *
 * Unexported: a caller that needs the type has the prop it belongs to, and can
 * spell it `ResourceLinkFormatProps['format']`.
 */
type ResourceLinkFormat = 'element' | 'markdown';

/**
 * Mixed into every `*Link` wrapper, so the level an embed was asked to render
 * at reaches the `ResourceLink` at the bottom without each wrapper restating
 * what the prop means.
 */
export interface ResourceLinkFormatProps {
  format?: ResourceLinkFormat;
}

interface ResolvedHref {
  /**
   * Fully qualified. Markdown is read away from the app -- pasted into a
   * ticket, a chat, a commit message -- where a site-relative path resolves
   * against whatever page it landed on, so every markdown destination carries
   * an origin even when the anchor beside it does not.
   */
  absolute: string;
  /**
   * What the rendered anchor navigates to, which stays relative while it is
   * on-site so the router handles it without a page load.
   */
  anchor: string;
  isExternal: boolean;
}

/**
 * Seer writes hrefs into the tag body, so only a recognised shape resolves: an
 * absolute http(s) URL that passes the markdown safety check, or a
 * site-relative path. Anything else -- a `javascript:` URL, a protocol-relative
 * `//host` that would leave the site without looking like it -- resolves to
 * null and renders nothing at either format.
 */
function resolveResourceHref(href: string): ResolvedHref | null {
  if (/^https?:\/\//.test(href) && isSafeHref(href)) {
    const parsed = safeURL(href);
    if (!parsed) {
      return null;
    }
    if (parsed.origin !== window.location.origin) {
      return {anchor: href, absolute: href, isExternal: true};
    }
    const path = parsed.pathname + parsed.search + parsed.hash;
    return {anchor: path, absolute: window.location.origin + path, isExternal: false};
  }

  if (/^\/[^/]/.test(href)) {
    return {
      anchor: href,
      absolute: window.location.origin + href,
      isExternal: false,
    };
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

function markdownLink(resolved: ResolvedHref, title: string): string {
  return `[${escapeLinkText(title)}](${encodeLinkDestination(resolved.absolute)})`;
}

/**
 * The markdown form of a resource link, for the embeds that compose one into a
 * larger string and so have no element to give a `format` to. Returns null for
 * the same hrefs `ResourceLink` refuses.
 */
export function resourceLinkMarkdown(href: string, title: string): string | null {
  const resolved = resolveResourceHref(href);
  return resolved ? markdownLink(resolved, title) : null;
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
    return markdownLink(resolved, title);
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
      <ExternalLink href={resolved.anchor}>
        {icon} {title}
      </ExternalLink>
    );
  }

  return (
    <Link to={resolved.anchor}>
      {icon} {title}
    </Link>
  );
}
