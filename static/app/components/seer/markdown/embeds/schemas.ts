import {z} from 'zod';

const isoTimestampSchema = z.iso.datetime({offset: true});

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
      'Link to a page in the Sentry documentation. Use this whenever you ' +
      'reference a Sentry feature or concept that has official docs. ' +
      'The href MUST be an absolute https://docs.sentry.io/... URL.',
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
  chart: {
    description:
      'Display numeric data as a compact Sentry-style chart. Use this when the answer ' +
      'contains a meaningful time series or category comparison with at least three points. ' +
      'Use x_axis "time" with ISO 8601 timestamps and "category" for named buckets. ' +
      'For heatmaps, each series is a row and each point is a colored cell. ' +
      'For wheels, use one category series whose points are the ring segments. ' +
      'Duration values are milliseconds, percentage values are 0-100, and byte values are raw bytes.',
    level: ['block'],
    schema: z
      .object({
        title: z.string().min(1),
        subtitle: z.string().optional(),
        visualization: z
          .enum(['line', 'area', 'bar', 'heatmap', 'wheel'])
          .default('line'),
        x_axis: z.enum(['time', 'category']).default('time'),
        y_axis_unit: z
          .enum(['number', 'percentage', 'duration', 'bytes'])
          .default('number'),
        y_axis_label: z.string().optional(),
        series: z
          .array(
            z.object({
              name: z.string(),
              data: z
                .array(
                  z.object({
                    x: z.union([z.string(), z.number()]),
                    y: z.number(),
                  })
                )
                .min(1)
                .max(200),
            })
          )
          .min(1)
          .max(5),
      })
      .superRefine((chart, context) => {
        if (chart.x_axis === 'time') {
          chart.series.forEach((series, seriesIndex) => {
            series.data.forEach((point, pointIndex) => {
              if (
                typeof point.x === 'string' &&
                !isoTimestampSchema.safeParse(point.x).success
              ) {
                context.addIssue({
                  code: 'custom',
                  message: 'Time-axis string values must be ISO 8601 timestamps',
                  path: ['series', seriesIndex, 'data', pointIndex, 'x'],
                });
              }
            });
          });
        }

        if (chart.visualization === 'heatmap') {
          chart.series.forEach((series, seriesIndex) => {
            series.data.forEach((point, pointIndex) => {
              if (point.y >= 0) {
                return;
              }
              context.addIssue({
                code: 'custom',
                message: 'Heatmap values must be non-negative',
                path: ['series', seriesIndex, 'data', pointIndex, 'y'],
              });
            });
          });
        }

        if (chart.visualization !== 'wheel') {
          return;
        }

        if (chart.x_axis !== 'category') {
          context.addIssue({
            code: 'custom',
            message: 'Wheel charts require a category x-axis',
            path: ['x_axis'],
          });
        }
        if (chart.series.length !== 1) {
          context.addIssue({
            code: 'custom',
            message: 'Wheel charts require exactly one series',
            path: ['series'],
          });
        }

        const points = chart.series[0]?.data ?? [];
        if (points.length < 2 || points.length > 12) {
          context.addIssue({
            code: 'custom',
            message: 'Wheel charts require between 2 and 12 points',
            path: ['series', 0, 'data'],
          });
        }
        points.forEach((point, pointIndex) => {
          if (point.y >= 0) {
            return;
          }
          context.addIssue({
            code: 'custom',
            message: 'Wheel chart values must be non-negative',
            path: ['series', 0, 'data', pointIndex, 'y'],
          });
        });
        if (points.reduce((total, point) => total + point.y, 0) <= 0) {
          context.addIssue({
            code: 'custom',
            message: 'Wheel chart values must have a positive total',
            path: ['series', 0, 'data'],
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
              name: 'Errors',
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
