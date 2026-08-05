import {z} from 'zod';

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
} as const satisfies Record<string, SeerEmbedSchema>;

export type SeerEmbedName = keyof typeof SEER_EMBED_SCHEMAS;

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
      body: z.toJSONSchema(def.schema) as Record<string, unknown>,
      ...(def.examples && {
        examples: def.examples.map(e => ({label: e.label, data: e.data})),
      }),
      ...(def.featureFlag !== undefined && {featureFlag: def.featureFlag}),
    };
  });
}
