import type {ReactNode} from 'react';
import {createContext, Fragment, isValidElement, useContext} from 'react';
import {matchRoutes, type RouteObject} from 'react-router';
import * as Sentry from '@sentry/react';

import {Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {isInternalHref, Markdown, type MarkdownProps} from '@sentry/scraps/markdown';
import {Heading} from '@sentry/scraps/text';

import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import {useRouteConfig} from 'sentry/router/routeConfigContext';
import {Redirect} from 'sentry/router/translateSentryRoute';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

import {
  type SeerEmbedBlockHostActions,
  SeerEmbedBlockHostActionsContext,
} from './embeds/components/seerEmbedBlock';
import {type SeerEmbedScope, SeerEmbedScopeContext} from './embeds/renderTracking';
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
const LeadingEmbedContext = createContext<{
  actions: SeerEmbedBlockHostActions;
  raw: string;
} | null>(null);

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
 * Markdown re-renders links on every streamed chunk and the route tree is large,
 * so cache match results per route config.
 */
const routeMatchCache = new WeakMap<RouteObject[], Map<string, boolean>>();

const PARAM_ONLY_PATH = /^:\w+\/?$/;

function isRedirectRoute(route: RouteObject): boolean {
  return isValidElement(route.element) && route.element.type === Redirect;
}

/**
 * Whether `path` resolves to a real frontend route. Three kinds of match don't
 * count: one ending on a bare `*` splat (the app's 404 handlers), one whose
 * pattern starts with a param (the legacy `/:orgId/` and `/:orgId/:projectId/`
 * redirects, which accept any one- or two-segment path), and one ending on a
 * param-only redirect or layout (e.g. `/settings/:orgId/:projectId/`), which
 * also accepts any segment, including a mistyped page name. On customer
 * domains, a match that fills the stripped `:orgId` doesn't count either.
 */
function matchesKnownRoute(routeConfig: RouteObject[], path: string): boolean {
  let cache = routeMatchCache.get(routeConfig);
  if (!cache) {
    cache = new Map();
    routeMatchCache.set(routeConfig, cache);
  }
  const cached = cache.get(path);
  if (cached !== undefined) {
    return cached;
  }
  let isKnown = false;
  try {
    const matches = matchRoutes(routeConfig, path);
    const leafRoute = matches?.at(-1)?.route;
    const firstSegment = matches
      ?.map(match => match.route.path ?? '')
      .join('/')
      .split('/')
      .find(Boolean);
    const isParamCatchAll =
      leafRoute !== undefined &&
      PARAM_ONLY_PATH.test(leafRoute.path ?? '') &&
      (isRedirectRoute(leafRoute) || !!leafRoute.children?.length);
    // Customer-domain paths have the org slug stripped, so a match that still
    // fills `:orgId` took some other segment as the slug (e.g. `/settings/typo/`).
    const fillsStrippedOrgId =
      USING_CUSTOMER_DOMAIN && matches?.at(-1)?.params.orgId !== undefined;
    isKnown =
      leafRoute !== undefined &&
      leafRoute.path !== '*' &&
      !firstSegment?.startsWith(':') &&
      !isParamCatchAll &&
      !fillsStrippedOrgId;
  } catch {
    isKnown = false;
  }
  cache.set(path, isKnown);
  return isKnown;
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
  Tag: function SeerTag({name, data, level, attrs, index, raw}) {
    const structuredContent = useContext(StructuredContentContext);
    const leading = useContext(LeadingEmbedContext);
    const Embed = SeerEmbedRegistry.get(name);
    if (Embed) {
      const embedData =
        name in STRUCTURED_SEER_EMBED_SCHEMAS
          ? structuredContent?.[name]
          : data === undefined
            ? structuredContent?.[name]
            : data;
      const embed = <Embed name={name} data={embedData} level={level} index={index} />;
      if (level === 'inline') {
        return embed;
      }
      // Only the tag the message opens with takes the host's actions. `index`
      // keeps an identical tag further down from matching too.
      const hostActions =
        leading && index === 0 && leading.raw.trimStart().startsWith(raw.trim())
          ? leading.actions
          : null;
      return (
        <Container>
          <SeerEmbedBlockHostActionsContext.Provider value={hostActions}>
            {embed}
          </SeerEmbedBlockHostActionsContext.Provider>
        </Container>
      );
    }
    // Unknown embeds are expected to be registered here; drop them and report
    // instead of echoing plaintext like default Markdown.
    reportUnhandledTag(name, level, attrs);
    return null;
  },
  Link: function SeerLink({children, Default, href, title}) {
    const routeConfig = useRouteConfig();
    const relativeHref = toRelativeHref(href);
    // Seer links in org form (`/organizations/:orgId/...`). Only link paths that
    // resolve to a real route once shortened for customer domains. The rendered
    // `Link` normalizes `to` itself, and `normalizeUrl` isn't idempotent, so
    // pass it the org form rather than the normalized path.
    if (
      routeConfig &&
      isInternalHref(relativeHref) &&
      !matchesKnownRoute(routeConfig, normalizeUrl(relativeHref))
    ) {
      return (
        <IsInsideLinkContext.Provider value>{children}</IsInsideLinkContext.Provider>
      );
    }
    return (
      <IsInsideLinkContext.Provider value>
        <Default href={relativeHref} title={title}>
          {children}
        </Default>
      </IsInsideLinkContext.Provider>
    );
  },
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
  leadingEmbedActions = null,
  structuredContent = null,
  scope = null,
  ...props
}: MarkdownProps & {
  /**
   * Controls for the block embed the message opens with, at the end of its
   * card's header. For a host whose own controls sit beside the message's first
   * line, which an embed there would otherwise have to leave room for.
   */
  leadingEmbedActions?: SeerEmbedBlockHostActions | null;
  /**
   * Conversation and message this markdown belongs to. Supply it to record
   * embed renders; omit it (stories, demos, previews) to render untracked.
   *
   * Scoped to this call rather than to the message, so a surface that renders
   * one message through two `SeerMarkdown` calls would give both embeds the
   * same index. Pass the whole message in one call.
   */
  scope?: SeerEmbedScope | null;
  structuredContent?: Record<string, unknown> | null;
}) {
  return (
    <SeerEmbedScopeContext.Provider value={scope}>
      <StructuredContentContext.Provider value={structuredContent}>
        <LeadingEmbedContext.Provider
          value={leadingEmbedActions && {actions: leadingEmbedActions, raw: props.raw}}
        >
          <Markdown {...props} components={{...SEER_EMBED_COMPONENTS, ...components}} />
        </LeadingEmbedContext.Provider>
      </StructuredContentContext.Provider>
    </SeerEmbedScopeContext.Provider>
  );
}
