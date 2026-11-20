import {z} from 'zod';

/**
 * Citations are typed pointers to the exact piece of user data a Seer claim
 * rests on: an event's stack frame, a span, a log line, a moment in a replay,
 * a query result, a range of source lines.
 *
 * Seer produces them: every tool records what it actually looked at, and the
 * agent cites them by `id`. Sentry owns this schema because Sentry renders
 * them. It reaches Seer as JSON Schema through `citations.generated.json`
 * (`pnpm gen:citations`).
 *
 * Every kind shares an envelope; `locator` carries the kind-specific pointer.
 * The claim a citation supports is not part of it -- consumers pair claims
 * with citation ids so one datum can back several claims.
 *
 * `external` is the escape hatch: a new Seer data source can cite through it
 * before Sentry knows how to render that source richly.
 */

const CITATION_SCHEMA_VERSION = 1;

const isoTimestamp = z.iso.datetime({offset: true});
const hexId32 = z.string().regex(/^[0-9a-f]{32}$/i);
const numericId = z.string().regex(/^\d+$/);

const envelope = {
  id: z
    .string()
    .regex(/^c_[0-9a-z]{4,32}$/)
    .describe('Ledger id the agent cites, e.g. "c_3fa1b2". Stable for the same datum.'),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Short human label, e.g. "POST /checkout span" or "cart.py:120-134".'),
  excerpt: z
    .string()
    .max(1_000)
    .optional()
    .describe(
      'The exact text or value the claim relies on, copied from the tool output.'
    ),
  observedAt: isoTimestamp
    .optional()
    .describe('When the cited datum happened, if it has a timestamp.'),
  projectId: numericId.optional(),
  url: z.url().optional().describe('Deep link built by Seer. The UI may build its own.'),
};

const issueLocator = z.object({
  groupId: numericId,
  shortId: z.string().min(1).optional(),
  stat: z
    .object({
      name: z.enum(['users', 'events', 'firstSeen', 'lastSeen']),
      value: z.union([z.number(), z.string()]),
    })
    .optional()
    .describe('A single issue-level statistic the claim relies on.'),
});

const eventFocus = z.union([
  z.object({
    type: z.literal('frame'),
    exceptionIndex: z.number().int().min(0).default(0),
    frameIndex: z.number().int().min(0),
    function: z.string().optional(),
    filename: z.string().optional(),
    lineNo: z.number().int().optional(),
  }),
  z.object({
    type: z.literal('tag'),
    key: z.string().min(1),
    value: z.string().optional(),
  }),
  z.object({type: z.literal('breadcrumb'), index: z.number().int().min(0)}),
  z.object({type: z.literal('context'), key: z.string().min(1)}),
]);

const eventLocator = z.object({
  eventId: hexId32,
  groupId: numericId.optional(),
  focus: eventFocus.optional().describe('Narrows the citation to one part of the event.'),
});

const traceLocator = z.object({
  traceId: hexId32,
  spanId: z
    .string()
    .regex(/^[0-9a-f]{16}$/i)
    .optional(),
});

const logLocator = z.object({
  logId: z.string().min(1).optional(),
  traceId: hexId32.optional(),
  timestamp: isoTimestamp.optional(),
});

const replayLocator = z.object({
  replayId: hexId32,
  offsetMs: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Milliseconds from the start of the replay.'),
  timestamp: isoTimestamp.optional().describe('Wall-clock time of the cited moment.'),
});

const profileLocator = z.object({
  profileId: z.string().min(1),
  projectSlug: z.string().min(1),
  function: z.string().optional(),
});

const queryLocator = z.object({
  dataset: z.enum(['spans', 'logs', 'errors', 'issues', 'metrics', 'replays']),
  query: z.string().default(''),
  fields: z.array(z.string()).optional(),
  yAxes: z.array(z.string()).optional(),
  groupBy: z.array(z.string()).optional(),
  projects: z.array(numericId).optional(),
  statsPeriod: z
    .string()
    .regex(/^\d+[smhdw]$/)
    .optional(),
  start: isoTimestamp.optional(),
  end: isoTimestamp.optional(),
  resultSummary: z
    .string()
    .max(500)
    .optional()
    .describe('What the query returned, e.g. "count()=4,112; count_unique(user)=903".'),
});

const feedbackLocator = z.object({
  feedbackId: z.string().min(1).describe('The feedback event id or issue id.'),
  groupId: numericId.optional(),
});

const codeLocator = z.object({
  repo: z.string().min(1).describe('owner/name'),
  path: z.string().min(1),
  ref: z.string().min(1).optional().describe('Commit sha or branch the lines came from.'),
  startLine: z.number().int().min(1).optional(),
  endLine: z.number().int().min(1).optional(),
});

const commitLocator = z.object({
  repo: z.string().min(1),
  sha: z.string().regex(/^[0-9a-f]{7,40}$/i),
});

const pullRequestLocator = z.object({
  repo: z.string().min(1),
  number: z.number().int().min(1),
});

const externalLocator = z.object({
  url: z.url(),
  source: z.string().max(64).optional().describe('Where it came from, e.g. "docs".'),
});

function kind<K extends string, L extends z.ZodObject>(name: K, locator: L) {
  return z.object({kind: z.literal(name), ...envelope, locator});
}

const CITATION_KIND_SCHEMAS = {
  issue: kind('issue', issueLocator),
  event: kind('event', eventLocator),
  trace: kind('trace', traceLocator),
  log: kind('log', logLocator),
  replay: kind('replay', replayLocator),
  profile: kind('profile', profileLocator),
  query: kind('query', queryLocator),
  feedback: kind('feedback', feedbackLocator),
  code: kind('code', codeLocator),
  commit: kind('commit', commitLocator),
  pullRequest: kind('pullRequest', pullRequestLocator),
  external: kind('external', externalLocator),
} as const;

export type CitationKind = keyof typeof CITATION_KIND_SCHEMAS;

export const CITATION_KINDS = Object.keys(CITATION_KIND_SCHEMAS) as CitationKind[];

const citationSchema = z.discriminatedUnion('kind', [
  CITATION_KIND_SCHEMAS.issue,
  CITATION_KIND_SCHEMAS.event,
  CITATION_KIND_SCHEMAS.trace,
  CITATION_KIND_SCHEMAS.log,
  CITATION_KIND_SCHEMAS.replay,
  CITATION_KIND_SCHEMAS.profile,
  CITATION_KIND_SCHEMAS.query,
  CITATION_KIND_SCHEMAS.feedback,
  CITATION_KIND_SCHEMAS.code,
  CITATION_KIND_SCHEMAS.commit,
  CITATION_KIND_SCHEMAS.pullRequest,
  CITATION_KIND_SCHEMAS.external,
]);

export type Citation = z.output<typeof citationSchema>;
export type CitationOfKind<K extends CitationKind> = z.output<
  (typeof CITATION_KIND_SCHEMAS)[K]
>;

/**
 * Parses a citation from the API. Returns null for anything Sentry can't
 * render, so one bad citation never hides the claims around it.
 */
export function parseCitation(data: unknown): Citation | null {
  const result = citationSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function citationsToJsonSchema(): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'SeerCitation',
    version: CITATION_SCHEMA_VERSION,
    kinds: CITATION_KINDS,
    ...z.toJSONSchema(citationSchema, {io: 'input'}),
  };
}
