import {z} from 'zod';

import {API_ACCESS_SCOPES} from 'sentry/constants/apiAccessScopes';

const isoTimestampSchema = z.iso.datetime({offset: true});

const chartSeriesDataSchema = z
  .array(
    z.object({
      x: z.union([z.string(), z.number()]),
      y: z.number(),
    })
  )
  .min(1)
  .max(200);

const chartSeriesSchema = z.union([
  z.object({
    label: z.string().describe('Legend label for the series'),
    data: chartSeriesDataSchema,
  }),
  z.object({
    name: z.string().describe('Legacy alias for label'),
    data: chartSeriesDataSchema,
  }),
]);

// Agents often emit bare numbers for IDs; keep as a plain union (no .transform)
// so gen:embed-widgets can still export JSON Schema.
const idString = z.union([z.string(), z.number()]);

/**
 * Page filters shared by every query embed. Seer supplies these separately from
 * the search string so the frontend can hand them to the canonical URL builders
 * rather than parsing them back out of a pre-built querystring.
 */
const pageFilterFields = {
  projects: z
    .array(idString)
    .optional()
    .describe('Project IDs. Omit for the "My Projects" selection.'),
  environments: z.array(z.string()).optional(),
  statsPeriod: z
    .string()
    .regex(/^\d+[smhdw]$/)
    .optional()
    .describe(
      'Relative time range, e.g. "24h" or "7d". Mutually exclusive with start/end.'
    ),
  start: isoTimestampSchema.optional(),
  end: isoTimestampSchema.optional(),
};

/**
 * Explore surfaces (spans, logs, metrics) share a samples/aggregate mode. In
 * aggregate mode `groupBy` and `yAxes` drive the chart and table; in samples
 * mode they are ignored in favour of `fields`.
 */
const exploreQueryFields = {
  ...pageFilterFields,
  query: z.string().default(''),
  mode: z.enum(['samples', 'aggregate']).default('samples'),
  groupBy: z.array(z.string()).optional(),
  yAxes: z
    .array(z.string())
    .optional()
    .describe('Aggregate functions to chart, e.g. "count()" or "p95(span.duration)".'),
  sort: z.string().optional(),
  fields: z.array(z.string()).optional(),
  title: z.string().min(1).optional(),
};

type SeerEmbedLevel = 'inline' | 'block';

export interface SeerEmbedExample {
  data: Record<string, unknown>;
  label: string;
  level?: SeerEmbedLevel;
}

interface SeerEmbedSchema {
  description: string;
  level: SeerEmbedLevel[];
  schema: z.ZodObject;
  examples?: SeerEmbedExample[];
  featureFlag?: string;
}

export const SEER_EMBED_SCHEMAS = {
  timestamp: {
    description:
      'Display a formatted timestamp inline. ALL datetime values MUST use this embed — never output a bare date/time or relative phrase (e.g. "two days ago") as plaintext. Use format "absolute" for a specific date/time and "relative" for a human-friendly relative duration (the UI renders it live). Do not include redundant plaintext alongside the embed.',
    level: ['inline'],
    schema: z.object({
      value: z.string(),
      format: z.enum(['absolute', 'relative']).default('absolute'),
    }),
    examples: [
      {label: 'Absolute', data: {value: '2025-07-15T14:30:00Z', format: 'absolute'}},
      {label: 'Relative', data: {value: '2025-07-15T14:30:00Z', format: 'relative'}},
    ],
  },
  docs: {
    description:
      'Link to a page in the Sentry documentation (docs.sentry.io only). ' +
      'The href MUST be an absolute https://docs.sentry.io/... URL. ' +
      'NEVER use this for Sentry issue links — use the `issue` or `issues` embed instead.',
    level: ['inline'],
    schema: z.object({href: z.string(), title: z.string()}),
    examples: [
      {
        label: 'Doc link',
        data: {href: 'https://docs.sentry.io/product/issues/', title: 'Issues'},
      },
    ],
  },
  dashboard: {
    description:
      'The ONLY way to reference a saved Sentry dashboard. ' +
      'Use the dashboard ID exactly as returned by the dashboard API. ' +
      'Include the API-provided title when available. ' +
      'Inline: renders a compact link. ' +
      'Block: renders a live preview of the dashboard widgets. Do not duplicate ' +
      'the widget titles, queries, visualizations, or values as text. ' +
      'Never use a markdown link for dashboard references.',
    level: ['inline', 'block'],
    schema: z.object({
      id: z.string().min(1),
      title: z.string().min(1).optional(),
    }),
    examples: [
      {
        label: 'Dashboard',
        data: {id: '123', title: 'Application health'},
      },
    ],
  },
  dsn: {
    description:
      'Display a copyable Sentry DSN (Data Source Name) string. ' +
      'Use this whenever presenting a DSN to the user — never output it as bare text.',
    level: ['block'],
    schema: z.object({value: z.string()}),
    examples: [
      {
        label: 'DSN',
        data: {value: 'https://examplePublicKey@o0.ingest.sentry.io/0'},
      },
    ],
  },
  user: {
    description:
      'Mention a Sentry user or team inline. Renders an avatar and display name. ' +
      'Use the actor type ("user" or "team") and the actor\'s ID and name.',
    level: ['inline'],
    schema: z.object({
      id: z.string(),
      type: z.enum(['user', 'team']),
      name: z.string(),
    }),
    examples: [
      {label: 'User', data: {id: '1', type: 'user', name: 'Jane Doe'}},
      {label: 'Team', data: {id: '2', type: 'team', name: 'platform'}},
    ],
  },
  issue: {
    description:
      'The ONLY way to reference a Sentry issue. Requires the issue short ID ' +
      '(e.g. "PROJECT-123"). ' +
      'Inline: renders a compact link with the short id. ' +
      'Block: renders a full interactive issue row with title, events, users, ' +
      'assignee, and trend graph — do NOT duplicate any of that data as text. ' +
      'MUST NOT appear inside a markdown table or list. ' +
      'When referencing 2+ issues, use the `issues` embed instead. ' +
      'Never use `docs` or markdown links for issue references.',
    level: ['inline', 'block'],
    schema: z.object({id: z.string()}),
    examples: [
      {label: 'Inline', level: 'inline', data: {id: 'JAVASCRIPT-22SP'}},
      {label: 'Block', level: 'block', data: {id: 'JAVASCRIPT-22SP'}},
    ],
  },
  issues: {
    description:
      'The ONLY way to list multiple Sentry issues. Renders an interactive ' +
      'table with title, trend graph, events, users, priority, and assignee ' +
      'for each issue — do NOT duplicate any of that data as text. ' +
      'ALWAYS use this when referencing 2+ issues. ' +
      'MUST NOT appear inside a markdown table or list. ' +
      'Never use `docs`, `issue`, or markdown tables for multiple issues. ' +
      'Provide only the array of issue short IDs (e.g. "PROJECT-123").',
    level: ['block'],
    schema: z.object({ids: z.array(z.string())}),
    examples: [
      {
        label: 'Block',
        level: 'block',
        data: {ids: ['JAVASCRIPT-22SP', 'JAVASCRIPT-39HX', 'JAVASCRIPT-39ZF']},
      },
    ],
  },
  replay: {
    description:
      'The ONLY way to reference a Sentry Session Replay. ' +
      'Use the replay ID, not the legacy project-slug:replay-id form. ' +
      'Provide eventTimestamp as an ISO 8601 timestamp with a timezone offset ' +
      '(for example, Z or +00:00) when the replay should open around a relevant event. ' +
      'Inline: renders a compact link. ' +
      'Block: renders a standalone replay reference. ' +
      'Never use a markdown link for replay references.',
    level: ['inline', 'block'],
    schema: z.object({
      id: z.string().min(1),
      eventTimestamp: isoTimestampSchema
        .describe('ISO 8601 timestamp with a timezone offset (for example, Z or +00:00)')
        .optional(),
    }),
    examples: [
      {
        label: 'Inline',
        level: 'inline',
        data: {
          id: '4c1f2e3d1234567890',
          eventTimestamp: '2026-08-25T16:37:12Z',
        },
      },
      {
        label: 'Block',
        level: 'block',
        data: {
          id: '4c1f2e3d1234567890',
          eventTimestamp: '2026-08-25T16:37:12Z',
        },
      },
    ],
  },
  release: {
    description:
      'The ONLY way to reference a Sentry release. ' +
      'Use `version` exactly as the releases API returns it. ' +
      'Provide `projectId` when the release belongs to a specific project. ' +
      'Inline: renders a compact link. ' +
      'Block: renders release metadata, new issues, commit authors, the last commit, ' +
      'and recent deploys. Do not duplicate that data as text. ' +
      'Never use a markdown link for release references.',
    level: ['inline', 'block'],
    schema: z.object({
      version: z.string().min(1),
      projectId: idString.optional(),
    }),
    examples: [
      {
        label: 'Release',
        data: {version: 'example-app@1.2.3', projectId: '1'},
      },
    ],
  },
  chart: {
    description:
      'Display numeric data as a compact Sentry-style chart. For line, area, and bar charts, ' +
      'prefer at least three points. Use x_axis "time" only with offset-bearing ISO 8601 ' +
      'timestamps. Category axes are supported for bar charts only. ' +
      'Duration values are milliseconds, percentage values are 0-100, and byte values are raw bytes.',
    level: ['block'],
    schema: z
      .object({
        title: z.string().min(1),
        subtitle: z.string().optional(),
        visualization: z.enum(['line', 'area', 'bar']).default('line'),
        x_axis: z.enum(['time', 'category']).default('time'),
        y_axis_unit: z
          .enum(['number', 'percentage', 'duration', 'bytes'])
          .default('number'),
        series: z.array(chartSeriesSchema).min(1).max(5),
      })
      .superRefine((chart, context) => {
        if (chart.x_axis === 'category' && chart.visualization !== 'bar') {
          context.addIssue({
            code: 'custom',
            message: 'Category axes are only supported for bar charts',
            path: ['x_axis'],
          });
        }

        if (chart.x_axis === 'time') {
          chart.series.forEach((series, seriesIndex) => {
            series.data.forEach((point, pointIndex) => {
              if (
                typeof point.x !== 'string' ||
                !isoTimestampSchema.safeParse(point.x).success
              ) {
                context.addIssue({
                  code: 'custom',
                  message: 'Time-axis values must be ISO 8601 timestamps',
                  path: ['series', seriesIndex, 'data', pointIndex, 'x'],
                });
              }
            });
          });
        }
      }),
    examples: [
      {
        label: 'Error volume',
        data: {
          title: 'Error volume',
          subtitle: 'Last 6 hours',
          visualization: 'area',
          x_axis: 'time',
          y_axis_unit: 'number',
          series: [
            {
              label: 'Errors',
              data: [
                {x: '2026-07-30T12:00:00Z', y: 12},
                {x: '2026-07-30T13:00:00Z', y: 18},
                {x: '2026-07-30T14:00:00Z', y: 15},
                {x: '2026-07-30T15:00:00Z', y: 31},
                {x: '2026-07-30T16:00:00Z', y: 46},
                {x: '2026-07-30T17:00:00Z', y: 38},
              ],
            },
          ],
        },
      },
    ],
  },
  autofix: {
    featureFlag: 'organizations:seer-agent-autofix',
    description:
      'Render one step of a Seer Autofix run (root cause, solution, or code ' +
      'changes) as a collapsible block linking back to the issue. ' +
      'Emit this embed whenever the user signals intent to fix, solve, ' +
      'debug, or resolve a problem — e.g. "fix this issue", "solve the ' +
      'problem", "find the root cause", "why is this happening", "how do I ' +
      'resolve this error" — or asks for the status/result of an autofix ' +
      'run already in progress. `id` and `shortId` are the issue the run ' +
      'belongs to, exactly as the issue API returns them. `step` is the ' +
      'autofix step identifier exactly as the autofix API reports it — the ' +
      'UI renders the human-readable label, so do not send a display ' +
      'string. `result` is the full markdown write-up for that step. ' +
      'Prefer this embed over a plaintext explanation whenever an issue ' +
      'can be autofixed, and emit one embed per step rather than ' +
      'combining multiple steps into one.',
    level: ['block'],
    schema: z.object({
      step: z.enum(['root_cause', 'solution', 'code_changes', 'pr_iteration']),
      result: z.string(),
      id: z.string(),
      shortId: z.string(),
    }),
    examples: [
      {
        label: 'Root cause',
        data: {
          id: '1234567890',
          shortId: 'EXMPL-123',
          result:
            'The root cause of the issue is that the code is not working correctly.',
          step: 'root_cause' as const,
        },
      },
    ],
  },
  alert: {
    description:
      'The ONLY way to reference a Sentry alert. ' +
      'Use `id` exactly as the alerts API returns it, and set `kind` to match: ' +
      '"metric" for a metric alert, "issue" for an issue alert, "uptime" for an ' +
      'uptime alert, "cron" for a cron alert. ' +
      'Include the API-provided name when available. ' +
      'Never use a markdown link for alert references.',
    level: ['inline', 'block'],
    schema: z.object({
      id: z.string().min(1),
      kind: z.enum(['metric', 'issue', 'uptime', 'cron']),
      name: z.string().min(1).optional(),
    }),
    examples: [
      {
        label: 'Metric alert',
        data: {id: '4521', kind: 'metric', name: 'Checkout p95 latency'},
      },
      {label: 'Issue alert', data: {id: '881', kind: 'issue'}},
    ],
  },
  monitor: {
    description:
      'The ONLY way to reference a Sentry monitor (cron, uptime, or metric ' +
      'detector). Use the detector ID exactly as the monitors API returns it. ' +
      'Include the API-provided name when available. ' +
      'Never use a markdown link for monitor references.',
    level: ['inline', 'block'],
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
    }),
    examples: [{label: 'Monitor', data: {id: '9931', name: 'nightly-billing-sync'}}],
  },
  savedIssueView: {
    description:
      'The ONLY way to reference a saved Sentry issue view. ' +
      'Use the view ID exactly as the issue-views API returns it. ' +
      'Include the API-provided name when available. ' +
      'Never use a markdown link for issue view references.',
    level: ['inline', 'block'],
    schema: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
    }),
    examples: [
      {label: 'Saved issue view', data: {id: '77', name: 'Unresolved in checkout'}},
    ],
  },
  savedQuery: {
    description:
      'The ONLY way to reference a saved Explore query. ' +
      'Use the saved query ID exactly as the API returns it and set `dataset` ' +
      'to the dataset it was saved against. ' +
      'Include the API-provided name when available. ' +
      'Never use a markdown link for saved query references.',
    level: ['inline', 'block'],
    schema: z.object({
      id: z.string().min(1),
      dataset: z.enum(['spans', 'logs', 'metrics', 'replays']),
      name: z.string().min(1).optional(),
    }),
    examples: [
      {
        label: 'Saved query',
        data: {id: '312', dataset: 'spans', name: 'Slow checkout spans'},
      },
    ],
  },
  trace: {
    description:
      'The ONLY way to reference a Sentry trace (the trace waterfall view). ' +
      'Use the 32-character trace ID. Provide `timestamp` when known so the ' +
      'waterfall opens on the right time range, and `spanId` to focus a span. ' +
      'Never use a markdown link for trace references.',
    level: ['inline', 'block'],
    schema: z.object({
      traceId: z.string().min(1),
      timestamp: isoTimestampSchema.optional(),
      spanId: z.string().min(1).optional(),
    }),
    examples: [
      {
        label: 'Trace',
        data: {
          traceId: 'a1b2c3d4e5f678901234567890abcdef',
          timestamp: '2026-08-25T16:37:12Z',
        },
      },
    ],
  },
  profile: {
    description:
      'The ONLY way to reference a Sentry profile (the flamegraph view). ' +
      'Requires both the profile ID and the slug of the project it belongs to. ' +
      'Never use a markdown link for profile references.',
    level: ['inline', 'block'],
    schema: z.object({
      projectSlug: z.string().min(1),
      profileId: z.string().min(1),
    }),
    examples: [
      {
        label: 'Profile',
        data: {projectSlug: 'javascript', profileId: '7f3c2b1a9d8e4f60'},
      },
    ],
  },
  issuesQuery: {
    description:
      'Link to the issue stream filtered by a search query. ' +
      'Use this when pointing the user at a SET of issues defined by a search ' +
      'rather than specific known issues — if you already have the short IDs, ' +
      'use the `issue` or `issues` embed instead. ' +
      '`query` uses issue search syntax, e.g. "is:unresolved level:error".',
    level: ['inline', 'block'],
    schema: z.object({
      ...pageFilterFields,
      query: z.string().default(''),
      sort: z.string().optional(),
      title: z.string().min(1).optional(),
    }),
    examples: [
      {
        label: 'Unresolved errors',
        data: {
          query: 'is:unresolved level:error',
          statsPeriod: '7d',
          title: 'Unresolved errors',
        },
      },
    ],
  },
  errorsQuery: {
    description:
      'Link to an errors (Discover) query results page. ' +
      'Use this for tabular error exploration across events. ' +
      '`query` uses event search syntax and `fields` are the table columns. ' +
      'Provide `yAxes` to chart aggregates alongside the table.',
    level: ['inline', 'block'],
    schema: z.object({
      ...pageFilterFields,
      query: z.string().default(''),
      fields: z.array(z.string()).optional(),
      yAxes: z.array(z.string()).optional(),
      sort: z.string().optional(),
      title: z.string().min(1).optional(),
    }),
    examples: [
      {
        label: 'Errors by URL',
        data: {
          query: 'event.type:error',
          fields: ['title', 'count()', 'url'],
          statsPeriod: '24h',
          title: 'Checkout errors',
        },
      },
    ],
  },
  spansQuery: {
    description:
      'Link to an Explore > Traces (spans) query. ' +
      'Use mode "samples" to show individual spans and "aggregate" to group and ' +
      'chart them. In aggregate mode supply `groupBy` and `yAxes`. ' +
      '`query` uses span search syntax, e.g. "span.op:http.client".',
    level: ['inline', 'block'],
    schema: z.object(exploreQueryFields),
    examples: [
      {
        label: 'Slow HTTP spans',
        data: {
          query: 'span.op:http.client',
          mode: 'samples',
          sort: '-span.duration',
          statsPeriod: '24h',
        },
      },
      {
        label: 'p95 by span op',
        data: {
          query: '',
          mode: 'aggregate',
          groupBy: ['span.op'],
          yAxes: ['p95(span.duration)'],
          statsPeriod: '7d',
        },
      },
    ],
  },
  logsQuery: {
    description:
      'Link to an Explore > Logs query. ' +
      'Use mode "samples" to show individual log rows and "aggregate" to group ' +
      'and chart them. In aggregate mode supply `groupBy` and `yAxes`. ' +
      '`query` uses log search syntax, e.g. "severity:error".',
    level: ['inline', 'block'],
    schema: z.object(exploreQueryFields),
    examples: [
      {
        label: 'Error logs',
        data: {query: 'severity:error', mode: 'samples', statsPeriod: '24h'},
      },
      {
        label: 'Log volume by severity',
        data: {
          query: '',
          mode: 'aggregate',
          groupBy: ['severity'],
          yAxes: ['count(message)'],
          statsPeriod: '7d',
        },
      },
    ],
  },
  replaysQuery: {
    description:
      'Link to the Session Replay list filtered by a search query. ' +
      'Use this when pointing the user at a SET of replays — if you have a ' +
      'specific replay ID, use the `replay` embed instead. ' +
      '`query` uses replay search syntax, e.g. "user.email:user@example.com".',
    level: ['inline', 'block'],
    schema: z.object({
      ...pageFilterFields,
      query: z.string().default(''),
      sort: z.string().optional(),
      title: z.string().min(1).optional(),
    }),
    examples: [
      {
        label: 'Replays with rage clicks',
        data: {query: 'count_rage_clicks:>0', statsPeriod: '7d'},
      },
    ],
  },
  metricsQuery: {
    description:
      'Link to an Explore > Metrics query for a single trace metric. ' +
      'Requires the metric `name` and `type` exactly as the metrics API returns ' +
      'them. Use mode "aggregate" with `groupBy`/`yAxes` to chart the metric, or ' +
      '"samples" to list raw points.',
    level: ['inline', 'block'],
    schema: z.object({
      ...exploreQueryFields,
      name: z.string().min(1),
      type: z.string().min(1),
      unit: z.string().min(1).nullish(),
    }),
    examples: [
      {
        label: 'Checkout latency metric',
        data: {
          name: 'checkout.latency',
          type: 'distribution',
          unit: 'millisecond',
          mode: 'aggregate',
          yAxes: ['p95(value)'],
          statsPeriod: '24h',
        },
      },
    ],
  },
  autofixRef: {
    featureFlag: 'organizations:seer-agent-autofix',
    description:
      'Render a live view of one Seer Autofix step (root cause, solution, code ' +
      'changes, or PR iteration) that fetches and updates itself in the browser. ' +
      'Emit this immediately after starting or continuing an autofix step via RPC, in ' +
      'place of polling for the result yourself and writing it up: the embed ' +
      'shows progress while the step runs, then the result once it completes, ' +
      'with buttons to continue to the next step or retry on error. `id` and ' +
      '`shortId` are the issue the run belongs to, exactly as the issue API ' +
      'returns them. `runId` is the run identifier returned by the RPC call ' +
      '(its `sentry_run_id`, or `run_id` if that is unavailable). `step` is the ' +
      'autofix step identifier exactly as the autofix API reports it — the UI ' +
      'renders the human-readable label, so do not send a display string.',
    level: ['block'],
    schema: z.object({
      step: z.enum(['root_cause', 'solution', 'code_changes', 'pr_iteration']),
      id: z.string(),
      shortId: z.string(),
      runId: z.union([z.string(), z.number()]),
    }),
    examples: [
      {
        label: 'Root cause',
        data: {
          id: '1234567890',
          shortId: 'EXMPL-123',
          runId: '018f2c1a-6b7e-7c3e-9a2f-3e6b1a2c3d4e',
          step: 'root_cause' as const,
        },
      },
    ],
  },
} as const satisfies Record<string, SeerEmbedSchema>;

export const STRUCTURED_SEER_EMBED_SCHEMAS = {
  agentWriteApproval: {
    description: 'Request browser-session approval for Sentry API write scopes.',
    level: ['block'],
    schema: z.object({
      inputId: z.string().uuid(),
      requiredScopes: z.array(z.enum(API_ACCESS_SCOPES)).min(1),
      sessionId: z.string().min(1),
      status: z.enum(['pending', 'approved', 'rejected']),
    }),
  },
} as const satisfies Record<string, SeerEmbedSchema>;

export const ALL_SEER_EMBED_SCHEMAS = {
  ...SEER_EMBED_SCHEMAS,
  ...STRUCTURED_SEER_EMBED_SCHEMAS,
};

export type SeerEmbedName = keyof typeof ALL_SEER_EMBED_SCHEMAS;

export function seerEmbedsToJsonSchemas(): Array<{
  body: Record<string, unknown>;
  description: string;
  level: SeerEmbedLevel[];
  name: string;
  examples?: Array<{data: Record<string, unknown>; label: string}>;
  featureFlag?: string;
}> {
  return Object.entries(SEER_EMBED_SCHEMAS).map(([name, entry]) => {
    const def: SeerEmbedSchema = entry;
    return {
      name,
      description: def.description,
      level: [...def.level],
      body: z.toJSONSchema(def.schema),
      ...(def.examples && {
        examples: def.examples.map(e => ({label: e.label, data: e.data})),
      }),
      ...(def.featureFlag !== undefined && {featureFlag: def.featureFlag}),
    };
  });
}
