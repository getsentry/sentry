import type {LocationDescriptor} from 'history';
import queryString from 'query-string';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Sort} from 'sentry/utils/discover/fields';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {DEFAULT_EVENT_VIEW_MAP} from 'sentry/views/discover/results/data';
import {
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {DEFAULT_YAXIS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import {
  defaultAggregateSortBys,
  defaultMetricQuery,
  encodeMetricQueryParams,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {makeMetricsAggregate} from 'sentry/views/explore/metrics/utils';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import type {CallRecord, ToolLink} from 'sentry/views/seerExplorer/types';

/**
 * Where a Code Mode call sends you.
 *
 * `LINK_RULES` below is the only place in the app that knows. One table, one entry shape.
 *
 * Resolution order:
 * 1. A lib helper or seer-emitted link whose `name` equals a rule id is tried first (by name).
 * 2. Otherwise the **longest path prefix** wins: each entity rule declares a `prefix` regex over the
 *    templated API path; the match that ends furthest to the right is preferred, so
 *    `/issues/{issue_id}/tags/` links as an issue and `/projects/.../releases/{version}/files/` as a
 *    release rather than a project. Ties keep table order. A rule that matches but returns null is
 *    skipped and the next-longest is tried.
 * 3. A call no rule claims still renders as a row — it just is not a link.
 *
 * ## Adding a link
 *
 * Say someone asks for "Retrieving project 12345 should link to the project page":
 *
 * 1. Find the route. The row's text is a title seer generates from
 *    `src/seer/experimental/mcp/call_title_lock.json` in the seer repo — grep the phrase there and
 *    the key is the `"<METHOD> <templated path>"` you need.
 * 2. Add a rule. Give it a `prefix` over the entity segment in the templated path (not only the
 *    end-of-path form). Nested calls under that entity inherit the same destination. `resolve`
 *    returns `{label, url}`, or `null` to decline and let a shorter prefix try.
 * 3. Add its example to `LINK_RULE_EXAMPLES` in `links.spec.tsx`. The spec asserts every rule has
 *    one and that the example resolves to that rule under longest-prefix selection.
 * 4. `pnpm test-ci static/app/views/seerExplorer/`.
 *
 * Nothing on the seer side changes, and no other file needs editing.
 *
 * ## Two things a rule must honor
 *
 * Every rule produces a link. A rule that only wants to rename a row does not belong here: row text
 * is seer's to write, and `callRecords.tsx` renders the title it ships for every call. So `resolve`
 * returns a `label` and a `url` together — a link seer emits directly carries no title to fall back
 * on, and an anchor with no text is not a link.
 *
 * Fail closed. When a rule cannot construct a destination it is sure of, return `null` — the row
 * still renders with seer's title, unlinked. A dead link is worse than no link.
 */

export type LinkContext = {
  organization: Organization;
  projects?: Array<{id: string; slug: string}>;
};

export type LinkSubject = {
  /**
   * Which channel this came from.
   *
   * `api` and `lib` are the two `CallRecord` shapes; `link` is a link seer emitted directly,
   * alongside the calls. Only `telemetry_live_search` reads this, because it is the one name that
   * arrives on two channels and means something different on each.
   */
  kind: 'api' | 'lib' | 'link';
  /** Path params for an api call, or the params attached to a seer-emitted link. */
  params: Record<string, any>;
  method?: string;
  /** A lib method name, or the kind of a seer-emitted link. Matched against a rule's `id`. */
  name?: string;
  /** The templated route, e.g. `/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/`. */
  path?: string;
  /** What was actually requested, query string removed. */
  pathname?: string;
  /** The requested query string, parsed — params the route template does not name. */
  query?: Record<string, string>;
  status?: number;
  /** The title seer shipped for this call. Absent on a seer-emitted link. */
  title?: string;
};

export type LinkResult = {
  /** Anchor text. Seer's title for the call when it has one, since it names the subject. */
  label: string;
  url: LocationDescriptor;
};

export type LinkRule = {
  /**
   * Identifies the rule, and doubles as the call name it answers to: a lib method or seer-emitted
   * link whose name equals this id reaches the rule without needing a path `prefix`.
   *
   * Reported as the `tool_kind` analytics dimension when the link is clicked, so renaming one
   * breaks that series.
   */
  id: string;
  resolve: (subject: LinkSubject, ctx: LinkContext) => LinkResult | null;
  /**
   * Templated-path segment this rule owns. Used for longest-prefix selection among path-matched
   * API rows. Omit for name-only rules (lib helpers, seer-emitted links, search).
   */
  prefix?: RegExp;
};

/**
 * Param values that name a resource to the API but not to the UI.
 *
 * The Sentry API resolves these server-side — `GET /issues/54/events/latest/` returns the newest
 * event — but the corresponding UI route expects a concrete id, so linking one produces a dead
 * page.
 */
const API_ONLY_ALIASES = new Set(['latest', 'oldest', 'recommended', 'me']);

/**
 * A param value as a URL segment, or `undefined` if it names nothing the UI can navigate to.
 *
 * Params reach a rule as untyped JSON. A `CallRecord`'s path params are always strings, but seer
 * emits link params straight from its own payload, so an id can arrive as `54` as readily as `'54'`
 * — both name the same issue, and rejecting the number would silently drop the link.
 */
function asUrlSegment(value: unknown): string | undefined {
  const segment = typeof value === 'number' ? String(value) : value;
  if (typeof segment !== 'string' || segment === '' || API_ONLY_ALIASES.has(segment)) {
    return undefined;
  }
  return segment;
}

/**
 * The issue rule, referenced by the event rule below so an alias can delegate to it by name rather
 * than by re-deriving the issue URL.
 */
const ISSUE_RULE: LinkRule = {
  id: 'get_issue_details',
  // Any call under `/issues/{issue_id}/…` (tags, notes, hashes, …) inherits the issue page.
  prefix: /\/issues\/\{issue_id\}/,
  resolve: ({params, title}) => {
    const {start, end} = params;
    const issueId = asUrlSegment(params.issue_id);
    if (!issueId) {
      return null;
    }

    const query = {start: validateIso(start), end: validateIso(end)};
    const label = title ?? t('View issue');

    // Only reachable from the older `get_issue_and_event_details`, which carried both ids.
    const eventId = asUrlSegment(params.event_id);
    if (eventId) {
      return {label, url: {pathname: `/issues/${issueId}/events/${eventId}/`, query}};
    }
    return {label, url: {pathname: `/issues/${issueId}/`, query}};
  },
};

export const LINK_RULES: LinkRule[] = [
  // --- Entities. Each `prefix` is the path segment that names the subject. Nested routes under that
  // segment inherit the same destination via longest-prefix selection (e.g. issue tags → issue).
  // More specific prefixes (event under issue, release under project) win because they end further
  // to the right in the templated path. ---

  {
    id: 'get_event_details',
    // Issue-scoped event only — project events use `get_project_event`.
    prefix: /\/issues\/\{issue_id\}\/events\/\{event_id\}/,
    resolve: (subject, ctx) => {
      const {params, title} = subject;
      const {start, end} = params;

      // An alias names an event to the API but not to the UI, so fall back to the issue it belongs
      // to rather than building a page that 404s.
      const eventId = asUrlSegment(params.event_id);
      if (!eventId) {
        return ISSUE_RULE.resolve(subject, ctx);
      }
      const issueId = asUrlSegment(params.issue_id);
      if (!issueId) {
        return null;
      }

      return {
        label: title ?? t('View event'),
        url: {
          pathname: `/issues/${issueId}/events/${eventId}/`,
          query: {start: validateIso(start), end: validateIso(end)},
        },
      };
    },
  },
  ISSUE_RULE,
  {
    id: 'get_trace_waterfall',
    // Modern `/trace/` + `/trace-meta/`, and the older `events-trace*` shapes still seen on some
    // records. All of them name a trace and open the same waterfall.
    prefix: /\/(?:events-)?trace(?:-meta|-light)?\/\{trace_id\}/,
    resolve: ({params, title}) => {
      const {span_id, timestamp} = params;
      const traceId = asUrlSegment(params.trace_id);
      if (!traceId) {
        return null;
      }

      const query: Record<string, string> = {};
      // A concrete span deep-links into the waterfall rather than opening a separate page.
      const spanId = asUrlSegment(span_id);
      if (spanId) {
        query.node = `span-${spanId}`;
      }
      if (timestamp) {
        query.timestamp = String(timestamp);
      }

      return {
        label: title ?? (spanId ? t('View span') : t('View trace')),
        url: {pathname: `/explore/traces/trace/${traceId}/`, query},
      };
    },
  },
  // Lib helper: no route of its own, only scalar args. Kept as its own rule so a span lookup does
  // not depend on the less-specific trace child underneath it.
  {
    id: 'get_span_details',
    resolve: ({params, title}) => {
      const traceId = asUrlSegment(params.trace_id);
      const spanId = asUrlSegment(params.span_id);
      if (!traceId || !spanId) {
        return null;
      }

      return {
        label: title ?? t('View span'),
        url: {
          pathname: `/explore/traces/trace/${traceId}/`,
          query: {node: `span-${spanId}`},
        },
      };
    },
  },
  {
    id: 'get_replay_details',
    prefix: /\/replays\/\{replay_id\}/,
    resolve: ({params, title}, {organization}) => {
      const replayId = asUrlSegment(params.replay_id);
      if (!replayId) {
        return null;
      }

      return {
        label: title ?? t('View replay'),
        url: {
          pathname: makeReplaysPathname({path: `/${replayId}/`, organization}),
        },
      };
    },
  },
  {
    id: 'get_project_details',
    // Broad project root. Nested release/monitor/rule/event prefixes end further right and win.
    prefix: /\/projects\/\{organization_id_or_slug\}\/\{project_id_or_slug\}/,
    resolve: ({params, title}, {organization, projects}) => {
      const value = asUrlSegment(params.project_id_or_slug);
      if (!value) {
        return null;
      }

      const label = title ?? t('View project');
      const path = (slug: string) =>
        makeProjectsPathname({path: `/${slug}/`, organization});

      // The param is an id *or* a slug, and project pages route on slug — a numeric id renders "not
      // found". Resolve it against the projects the viewer can see, and leave the row unlinked when
      // it is not among them. A slug needs no lookup, which matters: the project list is not
      // guaranteed to be loaded in full.
      if (/^\d+$/.test(value)) {
        const project = projects?.find(p => p.id === value);
        return project
          ? {label, url: {pathname: path(project.slug), query: {project: project.id}}}
          : null;
      }
      return {label, url: {pathname: path(value)}};
    },
  },
  {
    id: 'get_profile_flamegraph',
    // Lib helper emits by name; the profiles API carries the project as a path param.
    prefix: /\/profiles\/\{profile_id\}/,
    resolve: ({params, title}, {projects}) => {
      const {is_continuous, start_ts, end_ts, thread_id} = params;
      const profileId = asUrlSegment(params.profile_id);
      if (!profileId) {
        return null;
      }

      const project =
        resolveProject(params.project_id ?? params.project_id_or_slug, projects) ?? null;
      if (!project) {
        return null;
      }

      const label = title ?? t('View profile');

      if (is_continuous) {
        // A continuous profile is a window rather than an object, so it needs its bounds.
        if (!start_ts || !end_ts) {
          return null;
        }
        return {
          label,
          url: {
            pathname: `/explore/profiles/profile/${project.slug}/flamegraph/`,
            query: {
              start: new Date(start_ts * 1000).toISOString(),
              end: new Date(end_ts * 1000).toISOString(),
              profilerId: profileId,
              ...(thread_id && {tid: thread_id}),
            },
          },
        };
      }

      return {
        label,
        url: {
          pathname: `/explore/profiles/profile/${project.slug}/${profileId}/flamegraph/`,
          ...(thread_id && {query: {tid: thread_id}}),
        },
      };
    },
  },
  {
    id: 'get_dashboard_details',
    prefix: /\/dashboards\/\{dashboard_id\}/,
    resolve: ({params, title}) => {
      const dashboardId = asUrlSegment(params.dashboard_id);
      if (!dashboardId) {
        return null;
      }

      return {
        label: title ?? t('View dashboard'),
        // Singular `/dashboard/` is the live route; `/dashboards/:id` redirects into it.
        url: {pathname: `/dashboard/${dashboardId}/`},
      };
    },
  },
  {
    id: 'get_release_details',
    prefix: /\/releases\/\{version\}/,
    resolve: ({params, title}, {organization, projects}) => {
      const version = asUrlSegment(params.version);
      if (!version) {
        return null;
      }

      const project = resolveProject(params.project_id_or_slug, projects);
      return {
        label: title ?? t('View release'),
        url: {
          pathname: makeReleasesPathname({
            organization,
            path: `/${encodeURIComponent(version)}/`,
          }),
          // Only pin a project filter when we know its numeric id — a slug-only fallback has no id
          // to put on the query string.
          ...(project?.id ? {query: {project: project.id}} : {}),
        },
      };
    },
  },
  {
    id: 'get_detector_details',
    prefix: /\/detectors\/\{detector_id\}/,
    resolve: ({params, title}, {organization}) => {
      const detectorId = asUrlSegment(params.detector_id);
      if (!detectorId) {
        return null;
      }

      return {
        label: title ?? t('View monitor'),
        url: {pathname: makeMonitorDetailsPathname(organization.slug, detectorId)},
      };
    },
  },
  {
    id: 'get_workflow_details',
    prefix: /\/workflows\/\{workflow_id\}/,
    resolve: ({params, title}, {organization}) => {
      const workflowId = asUrlSegment(params.workflow_id);
      if (!workflowId) {
        return null;
      }

      return {
        label: title ?? t('View alert'),
        url: {pathname: makeAutomationDetailsPathname(organization.slug, workflowId)},
      };
    },
  },
  {
    id: 'get_cron_monitor_details',
    // Classic cron monitors. The workflow-engine `detectors` route is a different surface and is
    // claimed above; these still need project + slug for the alerts UI.
    prefix: /\/monitors\/\{monitor_id_or_slug\}/,
    resolve: ({params, title}, {organization, projects}) => {
      const monitor = asUrlSegment(params.monitor_id_or_slug);
      if (!monitor) {
        return null;
      }

      const project = resolveProject(params.project_id_or_slug, projects);
      if (!project) {
        // Org-level monitor fetch has no project in path params. The cron detail page needs one,
        // and guessing wrong lands on a 404 — leave the row unlinked.
        return null;
      }

      return {
        label: title ?? t('View monitor'),
        url: {
          pathname: makeAlertsPathname({
            organization,
            path: `/rules/crons/${project.slug}/${encodeURIComponent(monitor)}/details/`,
          }),
        },
      };
    },
  },
  {
    id: 'get_issue_alert_rule',
    prefix: /\/rules\/\{rule_id\}/,
    resolve: ({params, title}, {organization, projects}) => {
      const ruleId = asUrlSegment(params.rule_id);
      if (!ruleId) {
        return null;
      }

      const project = resolveProject(params.project_id_or_slug, projects);
      if (!project) {
        return null;
      }

      // Legacy issue-alert detail; workflow-engine orgs redirect this onto the automation page.
      return {
        label: title ?? t('View alert rule'),
        url: {
          pathname: makeAlertsPathname({
            organization,
            path: `/rules/${project.slug}/${ruleId}/`,
          }),
        },
      };
    },
  },
  {
    id: 'get_member_details',
    prefix: /(?:\/members\/\{member_id\}|\/scim\/v2\/Users\/\{member_id\})/,
    resolve: ({params, title}, {organization}) => {
      const memberId = asUrlSegment(params.member_id);
      if (!memberId) {
        return null;
      }

      return {
        label: title ?? t('View member'),
        // Settings routes are already org-scoped; `scopeToOrganization` leaves `/settings/` alone.
        url: {pathname: `/settings/${organization.slug}/members/${memberId}/`},
      };
    },
  },
  {
    id: 'get_team_details',
    // Require the org+team teams route (or SCIM). Do not claim `/members/…/teams/…` membership rows.
    prefix:
      /(?:\/teams\/\{organization_id_or_slug\}\/\{team_id_or_slug\}|\/scim\/v2\/Groups\/\{team_id_or_slug\})/,
    resolve: ({params, title}, {organization}) => {
      const team = asUrlSegment(params.team_id_or_slug);
      if (!team) {
        return null;
      }

      // Team settings route on slug. A bare numeric id is not something we can resolve without a
      // team directory in context, so decline rather than build a dead settings URL.
      if (/^\d+$/.test(team)) {
        return null;
      }

      return {
        label: title ?? t('View team'),
        url: {pathname: `/settings/${organization.slug}/teams/${team}/`},
      };
    },
  },
  {
    id: 'get_project_event',
    // Project event fetch has no issue id. `/projects/:project/events/:event/` resolves the group
    // client-side (ProjectEventRedirect) — better than leaving the row dead when the issue route
    // cannot be built. Prefix ends after `{event_id}`, so it beats the bare project root.
    prefix:
      /\/projects\/\{organization_id_or_slug\}\/\{project_id_or_slug\}\/events\/\{event_id\}/,
    resolve: ({params, title}, {projects}) => {
      const eventId = asUrlSegment(params.event_id);
      if (!eventId) {
        return null;
      }

      const project = resolveProject(params.project_id_or_slug, projects);
      if (!project) {
        return null;
      }

      return {
        label: title ?? t('View event'),
        url: {pathname: `/projects/${project.slug}/events/${eventId}/`},
      };
    },
  },
  {
    id: 'get_log_attributes',
    resolve: ({params, title}) => {
      const traceId = asUrlSegment(params.trace_id);
      if (!traceId) {
        return null;
      }

      // TODO: No way to pass a substring filter to this page yet; add params.log_message_substring
      // when there is one.
      return {
        label: title ?? t('View logs'),
        url: {pathname: `/explore/logs/trace/${traceId}/`, query: {tab: 'logs'}},
      };
    },
  },
  {
    id: 'get_metric_attributes',
    resolve: ({params, title}) => {
      const traceId = asUrlSegment(params.trace_id);
      if (!traceId) {
        return null;
      }

      // TODO: No way to pass a name filter to this page yet; add params.metric_name when there is
      // one.
      return {
        label: title ?? t('View metrics'),
        url: {pathname: `/explore/metrics/trace/${traceId}/`, query: {tab: 'metrics'}},
      };
    },
  },

  // --- Searches. Not an entity: a set of results, reproduced as a query against the same dataset
  // seer read. ---

  {
    id: 'telemetry_live_search',
    resolve: ({kind, params, title}, {projects}) => {
      // Arrives on both channels. The bus link always carries the translated query. The call row
      // starts with only `dataset` + `question`; seer stamps the translated params onto the record
      // after the search returns, so a fresh row can deep-link the same way. Older rows without a
      // query still decline here and keep the residual bus link underneath.
      if (kind !== 'link' && kind !== 'lib') {
        return null;
      }
      if (kind === 'lib' && (params.query === undefined || params.query === null)) {
        return null;
      }

      const url = searchUrl(params, projects);
      if (!url) {
        return null;
      }

      // Prefer seer's title when present (the call row ships one); otherwise name the dataset so a
      // residual nav link is not a generic "View results" under a row that already says which
      // dataset ran.
      const datasetLabel = telemetryDatasetLabel(params.dataset);
      return {
        label: title ?? (datasetLabel ? t('View %s', datasetLabel) : t('View results')),
        url,
      };
    },
  },
];

/**
 * Where a call links to, or null when no rule claims it — which is the common case, and not a
 * failure: a row with no link is still a row, labeled by the title seer shipped.
 *
 * Name-matched rules (lib / seer bus) are tried first. Path-matched API rows use longest prefix:
 * the `prefix` match that ends furthest right wins; a resolve that returns null falls through to
 * the next-longest candidate.
 */
export function resolveLink(
  subject: LinkSubject,
  ctx: LinkContext
): ({id: string} & LinkResult) | null {
  // A DELETE's subject no longer exists by the time the row is on screen, so no rule can have
  // anywhere to send anyone. Checked once here rather than in each rule.
  if (subject.method === 'DELETE') {
    return null;
  }

  const finish = (rule: LinkRule, result: LinkResult) => ({
    id: rule.id,
    label: result.label,
    url: scopeToOrganization(result.url, ctx.organization),
  });

  // Lib helpers and seer-emitted links address a rule by name.
  if (subject.name) {
    const named = LINK_RULES.find(rule => rule.id === subject.name);
    if (named) {
      const result = named.resolve(subject, ctx);
      if (result) {
        return finish(named, result);
      }
    }
  }

  const path = subject.path ?? '';
  const ranked = LINK_RULES.flatMap((rule, index) => {
    if (!rule.prefix) {
      return [];
    }
    const match = rule.prefix.exec(path);
    if (!match) {
      return [];
    }
    return [{rule, index, end: match.index + match[0].length}];
  }).sort((a, b) => b.end - a.end || a.index - b.index);

  for (const {rule} of ranked) {
    const result = rule.resolve(subject, ctx);
    if (result) {
      return finish(rule, result);
    }
  }
  return null;
}

/** A call Code Mode reported, as something the rules can match on. */
export function subjectFromCallRecord(record: CallRecord): LinkSubject {
  const [pathname, query] = (record.resolved_path ?? '').split('?');

  return {
    kind: record.kind === 'lib' ? 'lib' : 'api',
    // API rows use path params. Lib rows use their scalar args — name-matched rules (e.g.
    // `get_span_details`) are the only ones that see them, since route `match` predicates key on
    // `path`, which a lib call does not have.
    params: record.kind === 'lib' ? (record.params ?? {}) : (record.path_params ?? {}),
    name: record.kind === 'lib' ? record.name : undefined,
    method: record.method,
    path: record.path,
    pathname: pathname || undefined,
    query: query ? (queryString.parse(query) as Record<string, string>) : undefined,
    status: record.status,
    title: record.title?.trim() || undefined,
  };
}

/** A link seer emitted directly, as something the rules can match on. */
export function subjectFromToolLink(link: ToolLink): LinkSubject {
  return {kind: 'link', params: link.params ?? {}, name: link.kind};
}

/**
 * Qualify an org-less path with the organization, then normalize.
 *
 * Rules write the path they think in — some Sentry routes are naturally written under
 * `/organizations/{slug}`, others bare — and a bare path only resolves under a customer domain, so
 * it 404s on a plain dev host. Qualifying here and running the result through `normalizeUrl` is
 * correct in both worlds, since `normalizeUrl` strips the prefix back off when a customer domain is
 * in play.
 */
function scopeToOrganization(
  url: LocationDescriptor,
  organization: Organization
): LocationDescriptor {
  const prefix = `/organizations/${organization.slug}`;

  if (typeof url === 'string') {
    return normalizeUrl(
      url.startsWith('/organizations/') || url.startsWith('/settings/')
        ? url
        : `${prefix}${url}`
    );
  }
  if (
    !url.pathname ||
    url.pathname.startsWith('/organizations/') ||
    url.pathname.startsWith('/settings/')
  ) {
    return normalizeUrl(url);
  }
  return normalizeUrl({...url, pathname: `${prefix}${url.pathname}`});
}

/**
 * Resolve a project id-or-slug against the viewer's project list.
 *
 * Returns undefined when the value is missing, or when a numeric id is not among the projects the
 * viewer can see. A slug is returned as `{id, slug}` with an empty id when the list has not loaded
 * that project — pages that only need the slug still work.
 */
function resolveProject(
  value: unknown,
  projects?: Array<{id: string; slug: string}>
): {id: string; slug: string} | undefined {
  const segment = asUrlSegment(value);
  if (!segment) {
    return undefined;
  }
  if (/^\d+$/.test(segment)) {
    return projects?.find(p => p.id === segment);
  }
  const known = projects?.find(p => p.slug === segment);
  return known ?? {id: '', slug: segment};
}

/** Validate an ISO string and return it with the 'Z' suffix stripped, or undefined if invalid. */
function validateIso(val: unknown): string | undefined {
  if (!val || typeof val !== 'string') {
    return undefined;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d.toISOString().replace(/Z$/, '');
}

function getStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return typeof value === 'string' ? [value] : [];
}

/** Dataset noun for residual telemetry links, or undefined when unknown. */
function telemetryDatasetLabel(dataset: unknown): string | undefined {
  switch (dataset) {
    case 'spans':
      return 'spans';
    case 'errors':
      return 'errors';
    case 'logs':
      return 'logs';
    case 'metrics':
    case 'tracemetrics':
      return 'metrics';
    case 'issues':
      return 'issues';
    default:
      return undefined;
  }
}

/**
 * The search a `telemetry_live_search` link stands for, as a URL onto the matching Explore page.
 *
 * Each dataset lands on a different page with its own query param vocabulary, so the shared page
 * filters are built once and the dataset branch translates from there.
 */
function searchUrl(
  params: Record<string, any>,
  projects?: Array<{id: string; slug: string}>
): LocationDescriptor | null {
  const {dataset, project_slugs, query, sort, stats_period, start, end} = params;

  const queryParams: Record<string, any> = {query: query || '', project: null};
  if (stats_period) {
    queryParams.statsPeriod = stats_period;
  }
  if (sort) {
    queryParams.sort = sort;
  }
  // The page filter expects no timezone (treated as UTC) or a +HH:MM offset.
  if (start) {
    queryParams.start = start.replace(/Z$/, '');
  }
  if (end) {
    queryParams.end = end.replace(/Z$/, '');
  }
  if (project_slugs?.length && projects) {
    const projectIds = project_slugs
      .map((slug: string) => projects.find(p => p.slug === slug)?.id)
      .filter((id: string | undefined) => id !== undefined);
    if (projectIds.length > 0) {
      queryParams.project = projectIds;
    }
  }

  if (dataset === 'issues') {
    return {pathname: '/issues/', query: queryParams};
  }
  if (dataset === 'errors') {
    return {
      pathname: '/explore/discover/homepage/',
      query: errorsQuery(queryParams, params),
    };
  }
  if (dataset === 'logs') {
    return {pathname: '/explore/logs/', query: logsQuery(queryParams, params)};
  }
  if (dataset === 'metrics' || dataset === 'tracemetrics') {
    const metric = buildMetricsQueryParam(params);
    return metric
      ? {pathname: '/explore/metrics/', query: {...queryParams, metric}}
      : null;
  }
  return {pathname: '/traces/', query: spansQuery(queryParams, params)};
}

function errorsQuery(
  queryParams: Record<string, any>,
  params: Record<string, any>
): Record<string, any> {
  const {y_axes, group_by} = params;
  const next: Record<string, any> = {
    ...queryParams,
    dataset: 'errors',
    queryDataset: 'error-events',
  };

  if (y_axes) {
    next.yAxis = y_axes;
  }

  // In Discover, group_by values become selected columns (the `field` param) alongside the y_axes
  // aggregates. Always force some: with no fields Discover re-routes to the saved default query.
  const fields = [...getStringArray(group_by), ...getStringArray(y_axes)];
  next.field = fields.length
    ? fields
    : [...DEFAULT_EVENT_VIEW_MAP[SavedQueryDatasets.ERRORS].fields];

  // Discover sort strips parentheses from aggregates: -count() -> -count
  if (next.sort) {
    next.sort = next.sort.replace(/\(\)/g, '');
  }

  return next;
}

function logsQuery(
  queryParams: Record<string, any>,
  params: Record<string, any>
): Record<string, any> {
  const {group_by, mode} = params;
  const {query, sort, ...rest} = queryParams;
  const next: Record<string, any> = {...rest, [LOGS_QUERY_KEY]: query || ''};

  if (sort) {
    next[LOGS_SORT_BYS_KEY] = sort;
  }
  if (group_by) {
    next[LOGS_GROUP_BY_KEY] = getStringArray(group_by);
  }
  if (mode) {
    next.mode = mode === 'aggregates' ? 'aggregate' : 'samples';
  }

  return next;
}

function spansQuery(
  queryParams: Record<string, any>,
  params: Record<string, any>
): Record<string, any> {
  const {y_axes, group_by, mode} = params;
  const next = {...queryParams};
  const aggregateFields: string[] = [];

  if (y_axes) {
    const axes = getStringArray(y_axes);
    const stringifiedAxes = axes.map(axis => JSON.stringify(axis));
    next.visualize = stringifiedAxes;
    next.yAxes = stringifiedAxes;
    aggregateFields.push(JSON.stringify({yAxes: axes}));
  }
  if (group_by) {
    const groupByArray = getStringArray(group_by);
    // Each groupBy value becomes a separate query param and aggregateField entry.
    next.groupBy = groupByArray;
    for (const groupByValue of groupByArray) {
      aggregateFields.push(JSON.stringify({groupBy: groupByValue}));
    }
  }
  if (mode) {
    next.mode = mode === 'aggregates' ? 'aggregate' : 'samples';
  }
  if (mode === 'traces') {
    next.table = 'trace';
  }
  if (aggregateFields.length > 0) {
    next.aggregateField = aggregateFields;
  }

  return next;
}

function getTraceMetricFromParams(params: Record<string, any>): TraceMetric | null {
  const rawTraceMetric = params.trace_metric;
  if (
    !rawTraceMetric ||
    typeof rawTraceMetric !== 'object' ||
    typeof rawTraceMetric.name !== 'string' ||
    typeof rawTraceMetric.type !== 'string'
  ) {
    return null;
  }

  const traceMetric: TraceMetric = {
    name: rawTraceMetric.name,
    type: rawTraceMetric.type,
  };
  if (typeof rawTraceMetric.unit === 'string') {
    traceMetric.unit = rawTraceMetric.unit;
  }
  return traceMetric;
}

function getMetricYAxis(yAxis: string, traceMetric: TraceMetric): string {
  const visualize = new VisualizeFunction(yAxis);
  const aggregate = visualize.parsedFunction?.name;
  if (!aggregate) {
    return yAxis;
  }

  return makeMetricsAggregate({aggregate, traceMetric});
}

function getDefaultMetricYAxis(traceMetric: TraceMetric): string {
  return makeMetricsAggregate({
    aggregate: DEFAULT_YAXIS_BY_TYPE[traceMetric.type] ?? 'sum',
    traceMetric,
  });
}

function parseMetricsSort(
  sort: unknown,
  normalizedYAxesByOriginal: Map<string, string>
): Sort | undefined {
  if (typeof sort !== 'string' || !sort) {
    return undefined;
  }

  const kind = sort.startsWith('-') ? 'desc' : 'asc';
  const sortField = sort.replace(/^-/, '');
  const normalizedYAxis = normalizedYAxesByOriginal.get(sortField);
  if (normalizedYAxis) {
    return {field: normalizedYAxis, kind};
  }

  const sortFunction = new VisualizeFunction(sortField).parsedFunction;
  if (sortFunction) {
    for (const mappedYAxis of normalizedYAxesByOriginal.values()) {
      const yAxisFunction = new VisualizeFunction(mappedYAxis).parsedFunction;
      if (yAxisFunction?.name === sortFunction.name) {
        return {field: mappedYAxis, kind};
      }
    }
  }

  return {field: sortField, kind};
}

function buildMetricsQueryParam(params: Record<string, any>): string[] | undefined {
  const traceMetric = getTraceMetricFromParams(params);
  if (!traceMetric) {
    return undefined;
  }

  const mode = params.mode === 'aggregates' ? Mode.AGGREGATE : Mode.SAMPLES;
  const base = defaultMetricQuery();

  // Seer y-axes use short names like "avg(duration)"; normalize them to fully qualified metric
  // aggregates like "avg(metrics.foo.duration)".
  const yAxes = getStringArray(params.y_axes);
  const resolvedYAxes = yAxes.length ? yAxes : [getDefaultMetricYAxis(traceMetric)];
  const normalizedYAxesByOriginal = resolvedYAxes.reduce((map, yAxis) => {
    map.set(yAxis, getMetricYAxis(yAxis, traceMetric));
    return map;
  }, new Map<string, string>());
  // VisualizeFunction instances that the Explore page uses to render charts.
  const visualizes = resolvedYAxes.map(
    yAxis => new VisualizeFunction(normalizedYAxesByOriginal.get(yAxis)!)
  );

  const aggregateFields: AggregateField[] = [
    ...getStringArray(params.group_by).map(groupBy => ({groupBy})),
    ...visualizes,
  ];
  const sortBys = parseMetricsSort(params.sort, normalizedYAxesByOriginal);

  const queryParams = base.queryParams.replace({
    query: typeof params.query === 'string' ? params.query : '',
    mode,
    aggregateFields,
    aggregateSortBys:
      mode === Mode.AGGREGATE && sortBys
        ? [sortBys]
        : defaultAggregateSortBys(aggregateFields),
    sortBys: mode === Mode.SAMPLES && sortBys ? [sortBys] : base.queryParams.sortBys,
  });

  return [encodeMetricQueryParams({metric: traceMetric, queryParams})];
}
