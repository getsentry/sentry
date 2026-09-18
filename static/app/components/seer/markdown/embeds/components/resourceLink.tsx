import type {ComponentType, ReactNode} from 'react';
import {css} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {isSafeHref} from '@sentry/scraps/markdown';

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
 * Both formats come out of one component, so a copied link cannot point
 * somewhere the rendered link does not. Reachable as
 * `ResourceLinkFormatProps['format']`.
 */
type ResourceLinkFormat = 'element' | 'markdown';

/** Lets a `*Link` wrapper pass the embed's level down to `ResourceLink`. */
export interface ResourceLinkFormatProps {
  format?: ResourceLinkFormat;
}

interface ResolvedHref {
  /** Fully qualified: copied markdown is read away from the app. */
  absolute: string;
  /** Relative while on-site, so the router handles it without a page load. */
  anchor: string;
  isExternal: boolean;
}

/**
 * Seer writes hrefs into the tag body, so only a safe http(s) URL or a
 * site-relative path resolves. Anything else -- `javascript:`, a
 * protocol-relative `//host` -- renders nothing at either format.
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
 * For embeds that compose a link into a larger string, so have no element to
 * give a `format` to. Refuses the same hrefs `ResourceLink` does.
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
