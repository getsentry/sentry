import type {SeerEmbedName} from 'sentry/components/seer/markdown/embeds/schemas';

import type {Citation, CitationOfKind} from './schemas';

export interface CitationEmbed {
  data: Record<string, unknown>;
  name: SeerEmbedName;
}

const QUERY_EMBEDS = {
  spans: 'spansQuery',
  logs: 'logsQuery',
  errors: 'errorsQuery',
  issues: 'issuesQuery',
  replays: 'replaysQuery',
} as const satisfies Record<
  Exclude<CitationOfKind<'query'>['locator']['dataset'], 'metrics'>,
  SeerEmbedName
>;

function withoutUndefined(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}

/**
 * The Seer embed that renders a citation's datum as a block: the same views
 * Seer uses inline in chat, so a cited span looks like a span everywhere.
 *
 * Returns null for kinds with no Sentry view (code, commits, external links),
 * which render as a link to `citation.url` instead.
 */
export function citationToEmbed(citation: Citation): CitationEmbed | null {
  switch (citation.kind) {
    case 'issue':
      return {
        name: 'issue',
        data: withoutUndefined({
          id: citation.locator.groupId,
          shortId: citation.locator.shortId,
        }),
      };
    case 'event': {
      const {eventId, groupId, focus} = citation.locator;
      if (!groupId) {
        return null;
      }
      return {
        name: 'event',
        data:
          focus?.type === 'tag'
            ? {id: eventId, issueId: groupId, view: 'tag', tagKeys: [focus.key]}
            : {id: eventId, issueId: groupId, view: 'summary'},
      };
    }
    case 'trace':
      return {
        name: 'traceWaterfall',
        data: withoutUndefined({
          traceId: citation.locator.traceId,
          spanId: citation.locator.spanId,
        }),
      };
    case 'log': {
      const {logId, traceId, timestamp} = citation.locator;
      if (!logId) {
        return null;
      }
      return {
        name: 'log',
        data: withoutUndefined({
          id: logId,
          traceId,
          timestamp,
          projectId: citation.projectId,
        }),
      };
    }
    case 'replay':
      return {
        name: 'replay',
        data: withoutUndefined({
          id: citation.locator.replayId,
          eventTimestamp: citation.locator.timestamp ?? citation.observedAt,
        }),
      };
    case 'profile':
      return {
        name: 'profile',
        data: {
          projectSlug: citation.locator.projectSlug,
          profileId: citation.locator.profileId,
        },
      };
    case 'query': {
      const {dataset, query, fields, yAxes, groupBy, projects, statsPeriod, start, end} =
        citation.locator;
      if (dataset === 'metrics') {
        // The metrics embed needs the metric's name, which a query citation lacks.
        return null;
      }
      const name = QUERY_EMBEDS[dataset];
      const aggregate = Boolean(yAxes?.length);
      const filters = withoutUndefined({
        query,
        projects,
        ...(start && end ? {start, end} : {statsPeriod}),
        title: citation.title,
      });
      if (name === 'issuesQuery') {
        return {name, data: filters};
      }
      if (name === 'errorsQuery') {
        return {
          name,
          data: withoutUndefined({
            ...filters,
            mode: aggregate ? 'aggregate' : 'samples',
            fields: aggregate ? [...(groupBy ?? []), ...(yAxes ?? [])] : fields,
            yAxes,
          }),
        };
      }
      if (name === 'replaysQuery') {
        return {name, data: filters};
      }
      return {
        name,
        data: withoutUndefined({
          ...filters,
          mode: aggregate ? 'aggregate' : 'samples',
          fields,
          yAxes,
          groupBy,
        }),
      };
    }
    case 'feedback':
    case 'code':
    case 'commit':
    case 'pullRequest':
    case 'external':
      return null;
    default:
      return null;
  }
}

/** Where a citation's datum lives, as a short phrase for its card. */
export function describeCitationLocation(citation: Citation): string | null {
  switch (citation.kind) {
    case 'event': {
      const focus = citation.locator.focus;
      if (focus?.type === 'frame') {
        const where = [focus.filename, focus.lineNo].filter(Boolean).join(':');
        return [focus.function, where && `(${where})`].filter(Boolean).join(' ') || null;
      }
      if (focus?.type === 'tag') {
        return `${focus.key}: ${focus.value ?? ''}`.trim();
      }
      if (focus?.type === 'breadcrumb') {
        return `breadcrumb #${focus.index + 1}`;
      }
      if (focus?.type === 'context') {
        return `${focus.key} context`;
      }
      return null;
    }
    case 'issue': {
      const stat = citation.locator.stat;
      return stat ? `${stat.name}: ${stat.value}` : null;
    }
    case 'replay': {
      const offset = citation.locator.offsetMs;
      if (offset === undefined) {
        return null;
      }
      const seconds = Math.floor(offset / 1000);
      return `at ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    case 'query':
      return citation.locator.resultSummary ?? null;
    case 'code': {
      const {path, startLine, endLine} = citation.locator;
      if (!startLine) {
        return path;
      }
      return `${path}:${startLine}${endLine && endLine !== startLine ? `-${endLine}` : ''}`;
    }
    default:
      return null;
  }
}
