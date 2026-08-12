import type {LocationDescriptor} from 'history';
import queryString from 'query-string';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Sort} from 'sentry/utils/discover/fields';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
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
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import type {CallRecord, ToolLink} from 'sentry/views/seerExplorer/types';

/**
 * Where a Code Mode call sends you, and what its row is called.
 *
 * `LINK_RULES` below is the only place in the app that knows either. One table, one entry shape,
 * read top to bottom, first rule that resolves wins.
 *
 * ## Adding a link
 *
 * Say someone asks for "Retrieving project 12345 should link to the project page":
 *
 * 1. Find the route. The row's text is a title seer generates from
 *    `src/seer/experimental/mcp/call_title_lock.json` in the seer repo — grep the phrase there and
 *    the key is the `"<METHOD> <templated path>"` you need.
 * 2. Add a rule. `match` is a plain predicate over the call; write a comparison or a regex inline.
 *    `resolve` returns `{label}`, `{label, url}`, or `null` to decline and let a later rule try.
 * 3. Add its example to `LINK_RULE_EXAMPLES` in `links.spec.tsx`. The spec asserts every rule has
 *    one, that the example actually reaches the rule (nothing above it matches first), and that it
 *    resolves — so a rule buried under a more generic one fails by name.
 * 4. `pnpm test-ci static/app/views/seerExplorer/`.
 *
 * Nothing on the seer side changes, and no other file needs editing.
 *
 * ## Two things a rule must honor
 *
 * A `url` requires a `label`. Links arriving straight from seer have no title to fall back on, so a
 * url without a label would render an anchor with no text; `resolveLink` drops it instead.
 *
 * Fail closed. When a rule cannot construct a destination it is sure of, return `null` — the row
 * still renders with its title, unlinked. A dead link is worse than no link.
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
  label?: string;
  url?: LocationDescriptor;
};

export type LinkRule = {
  /**
   * Identifies the rule, and doubles as the call name it answers to: a lib method or seer-emitted
   * link whose name equals this id reaches the rule without needing a `match`.
   *
   * Reported as the `tool_kind` analytics dimension when the link is clicked, so renaming one
   * breaks that series.
   */
  id: string;
  resolve: (subject: LinkSubject, ctx: LinkContext) => LinkResult | null;
  /** Omit for a rule that only ever answers to its own name. */
  match?: (subject: LinkSubject) => boolean;
};

/**
 * Param values that name a resource to the API but not to the UI.
 *
 * The Sentry API resolves these server-side — `GET /issues/54/events/latest/` returns the newest
 * event — but the corresponding UI route expects a concrete id, so linking one produces a dead
 * page.
 */
const API_ONLY_ALIASES = new Set(['latest', 'oldest', 'recommended', 'me']);

/** Whether a param value names something the UI can navigate to. */
function identifies(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !API_ONLY_ALIASES.has(value);
}

/**
 * The issue rule, referenced by the event rule below so an alias can delegate to it by name rather
 * than by re-deriving the issue URL.
 */
const ISSUE_RULE: LinkRule = {
  id: 'get_issue_details',
  match: ({path}) => /\{issue_id\}\/?$/.test(path ?? ''),
  resolve: ({params, title}) => {
    const {issue_id, event_id, start, end} = params;
    if (!identifies(issue_id)) {
      return null;
    }

    const query = {start: validateIso(start), end: validateIso(end)};
    const label = title ?? t('View issue');

    // Only reachable from the older `get_issue_and_event_details`, which carried both ids.
    if (identifies(event_id)) {
      return {label, url: {pathname: `/issues/${issue_id}/events/${event_id}/`, query}};
    }
    return {label, url: {pathname: `/issues/${issue_id}/`, query}};
  },
};

export const LINK_RULES: LinkRule[] = [
  // --- Specific routes. These refine the entity rules below, so they have to sit above them. ---

  {
    id: 'update_issues',
    match: ({method, path}) =>
      method === 'PUT' &&
      path === '/api/0/organizations/{organization_id_or_slug}/issues/',
    // A bulk update names no single issue, so there is nowhere to send anyone — but the row can at
    // least say whether it took.
    resolve: ({status}) => ({
      label: status && status < 300 ? t('Updated issues') : t('Update issues'),
    }),
  },

  // --- Entities. A route earns one of these by *ending* at the param that names its subject:
  // `/issues/{issue_id}/` is about an issue, `/issues/{issue_id}/tags/` is about tags, and there is
  // no tags page to send anyone to. ---

  {
    id: 'get_event_details',
    match: ({path}) => /\{event_id\}\/?$/.test(path ?? ''),
    resolve: (subject, ctx) => {
      const {params, title} = subject;
      const {event_id, issue_id, start, end} = params;

      // An alias names an event to the API but not to the UI, so fall back to the issue it belongs
      // to rather than building a page that 404s.
      if (!identifies(event_id)) {
        return ISSUE_RULE.resolve(subject, ctx);
      }
      if (!identifies(issue_id)) {
        return null;
      }

      return {
        label: title ?? t('View event'),
        url: {
          pathname: `/issues/${issue_id}/events/${event_id}/`,
          query: {start: validateIso(start), end: validateIso(end)},
        },
      };
    },
  },
  ISSUE_RULE,
  {
    id: 'get_trace_waterfall',
    match: ({path}) => /\{trace_id\}\/?$/.test(path ?? ''),
    resolve: ({params, title}) => {
      const {trace_id, span_id, timestamp} = params;
      if (!identifies(trace_id)) {
        return null;
      }

      const query: Record<string, string> = {};
      if (span_id) {
        query.node = `span-${span_id}`;
      }
      if (timestamp) {
        query.timestamp = timestamp;
      }

      return {
        label: title ?? t('View trace'),
        url: {pathname: `/explore/traces/trace/${trace_id}/`, query},
      };
    },
  },
  {
    id: 'get_replay_details',
    match: ({path}) => /\{replay_id\}\/?$/.test(path ?? ''),
    resolve: ({params, title}, {organization}) => {
      const {replay_id} = params;
      if (!identifies(replay_id)) {
        return null;
      }

      return {
        label: title ?? t('View replay'),
        url: {
          pathname: makeReplaysPathname({path: `/${replay_id}/`, organization}),
        },
      };
    },
  },
  {
    id: 'get_project_details',
    match: ({path}) => /\{project_id_or_slug\}\/?$/.test(path ?? ''),
    resolve: ({params, title}, {organization, projects}) => {
      const value = params.project_id_or_slug;
      if (!identifies(value)) {
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
    resolve: ({params, title}, {projects}) => {
      const {profile_id, project_id, is_continuous, start_ts, end_ts, thread_id} = params;
      if (!profile_id || !project_id) {
        return null;
      }

      const project = projects?.find(p => p.id === String(project_id));
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
              profilerId: profile_id,
              ...(thread_id && {tid: thread_id}),
            },
          },
        };
      }

      return {
        label,
        url: {
          pathname: `/explore/profiles/profile/${project.slug}/${profile_id}/flamegraph/`,
          ...(thread_id && {query: {tid: thread_id}}),
        },
      };
    },
  },
  {
    id: 'get_log_attributes',
    resolve: ({params, title}) => {
      const {trace_id} = params;
      if (!identifies(trace_id)) {
        return null;
      }

      // TODO: No way to pass a substring filter to this page yet; add params.log_message_substring
      // when there is one.
      return {
        label: title ?? t('View logs'),
        url: {pathname: `/explore/logs/trace/${trace_id}/`, query: {tab: 'logs'}},
      };
    },
  },
  {
    id: 'get_metric_attributes',
    resolve: ({params, title}) => {
      const {trace_id} = params;
      if (!identifies(trace_id)) {
        return null;
      }

      // TODO: No way to pass a name filter to this page yet; add params.metric_name when there is
      // one.
      return {
        label: title ?? t('View metrics'),
        url: {pathname: `/explore/metrics/trace/${trace_id}/`, query: {tab: 'metrics'}},
      };
    },
  },

  // --- Searches. Not an entity: a set of results, reproduced as a query against the same dataset
  // seer read. ---

  {
    id: 'telemetry_live_search',
    resolve: ({kind, params, title}, {projects}) => {
      // The one name that arrives on both channels. As a row it is a report of a search that
      // already happened; only the link seer emitted alongside carries the query to re-run.
      if (kind !== 'link') {
        return {label: t('Queried telemetry')};
      }

      const url = searchUrl(params, projects);
      return url ? {label: title ?? t('View results'), url} : null;
    },
  },

  // --- Lib methods that report what they did and have nowhere to point. ---

  {id: 'code_search', resolve: () => ({label: t('Searched code')})},
  {id: 'git_search', resolve: () => ({label: t('Searched commit history')})},
  {id: 'bash', resolve: () => ({label: t('Ran a command')})},
  {id: 'ask_user_question', resolve: () => ({label: t('Asked a question')})},
  {id: 'review_code_changes', resolve: () => ({label: t('Reviewed code changes')})},
];

/**
 * What a call links to and what its row is called, or null when no rule claims it.
 *
 * Rules run in order. One that matches but returns null has declined, and the search continues —
 * so a generic rule can sit under a specific one without swallowing it.
 */
export function resolveLink(
  subject: LinkSubject,
  ctx: LinkContext
): ({id: string} & LinkResult) | null {
  for (const rule of LINK_RULES) {
    if (subject.name !== rule.id && rule.match?.(subject) !== true) {
      continue;
    }

    const result = rule.resolve(subject, ctx);
    if (!result) {
      continue;
    }

    // A DELETE's subject no longer exists by the time the row is on screen, so the label stands and
    // the destination goes. Nothing else in here needs to think about the method.
    const url = subject.method === 'DELETE' ? undefined : result.url;

    if (result.label && url) {
      return {
        id: rule.id,
        label: result.label,
        url: scopeToOrganization(url, ctx.organization),
      };
    }
    if (result.label) {
      return {id: rule.id, label: result.label};
    }
    // A url with no label has no anchor text. Treated as a decline rather than rendered blank.
  }
  return null;
}

/** A call Code Mode reported, as something the rules can match on. */
export function subjectFromCallRecord(record: CallRecord): LinkSubject {
  const [pathname, query] = (record.resolved_path ?? '').split('?');

  return {
    kind: record.kind === 'lib' ? 'lib' : 'api',
    // Only path params. A lib call's own arguments are not route params, and reading them here
    // would let a rule keyed on a route build a link for a row that never made that request.
    params: record.path_params ?? {},
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
    return normalizeUrl(url.startsWith('/organizations/') ? url : `${prefix}${url}`);
  }
  if (!url.pathname || url.pathname.startsWith('/organizations/')) {
    return normalizeUrl(url);
  }
  return normalizeUrl({...url, pathname: `${prefix}${url.pathname}`});
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
