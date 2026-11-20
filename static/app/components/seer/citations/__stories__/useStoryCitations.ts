import {useQuery} from '@tanstack/react-query';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {EXAMPLE_CITATIONS} from 'sentry/components/seer/citations/__fixtures__/examples';
import {
  CITATION_KINDS,
  parseCitation,
  type Citation,
  type CitationKind,
} from 'sentry/components/seer/citations/schemas';
import {recentIssueApiOptions} from 'sentry/components/seer/markdown/__stories__/eventEmbedStory';
import {toIdentity} from 'sentry/components/seer/markdown/__stories__/logEmbedStory';
import {recentProfileApiOptions} from 'sentry/components/seer/markdown/__stories__/profileEmbedStory';
import type {Event, Frame} from 'sentry/types/event';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {replayListApiOptions} from 'sentry/utils/replays/replayListApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTracesApiOptions} from 'sentry/views/explore/hooks/useTraces';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
} from 'sentry/views/explore/logs/types';
import {groupEventApiOptions} from 'sentry/views/issueDetails/utils';

/**
 * Where a kind's preview comes from: real data in the signed-in organization,
 * the static example (for kinds that render without fetching), or nothing yet.
 */
type StoryCitationSource = 'live' | 'example' | 'loading' | 'missing';

export interface StoryCitations {
  /** Every citation the story can preview, live ones first within each kind. */
  citations: Citation[];
  sources: Record<CitationKind, StoryCitationSource>;
}

/** Kinds whose detail renders from the citation alone, with no fetch. */
const SELF_CONTAINED = new Set<CitationKind>([
  'feedback',
  'code',
  'commit',
  'pullRequest',
  'external',
]);

const PREFERRED_TAGS = ['browser', 'os', 'url', 'release', 'environment'];

function isCitation(citation: Citation | null): citation is Citation {
  return citation !== null;
}

function exceptionFrames(
  event: Event
): Array<{exceptionIndex: number; frame: Frame; frameIndex: number}> {
  const entry = event.entries?.find(e => e.type === 'exception');
  const values: Array<{stacktrace?: {frames?: Frame[]} | null}> =
    (entry?.data as {values?: Array<{stacktrace?: {frames?: Frame[]} | null}>})?.values ??
    [];
  return values.flatMap((exception, exceptionIndex) =>
    (exception.stacktrace?.frames ?? []).map((frame, frameIndex) => ({
      exceptionIndex,
      frame,
      frameIndex,
    }))
  );
}

function eventCitations(event: Event, groupId: string): Citation[] {
  const common = {
    kind: 'event',
    observedAt: event.dateCreated ?? undefined,
    projectId: event.projectID ? String(event.projectID) : undefined,
  } as const;
  const base = {eventId: event.id, groupId};
  const citations: Array<Citation | null> = [
    parseCitation({
      ...common,
      id: 'c_liveevent',
      title: event.title || `Event ${event.id.slice(0, 8)}`,
      excerpt: event.message || undefined,
      locator: base,
    }),
  ];

  // Innermost in-app frame: the crash site.
  const crash = exceptionFrames(event).findLast(({frame}) => frame.inApp);
  if (crash) {
    const {frame} = crash;
    const contextLine = frame.context?.find(([lineNo]) => lineNo === frame.lineNo)?.[1];
    citations.push(
      parseCitation({
        ...common,
        id: 'c_liveframe',
        title: `${frame.function ?? '<anonymous>'} in ${frame.filename ?? 'unknown file'}${
          frame.lineNo ? `:${frame.lineNo}` : ''
        }`,
        excerpt: contextLine ?? undefined,
        locator: {
          ...base,
          focus: {
            type: 'frame',
            exceptionIndex: crash.exceptionIndex,
            frameIndex: crash.frameIndex,
            function: frame.function ?? undefined,
            filename: frame.filename ?? undefined,
            lineNo: frame.lineNo ?? undefined,
          },
        },
      })
    );
  }

  const tag =
    PREFERRED_TAGS.map(key => event.tags?.find(t => t.key === key)).find(Boolean) ??
    event.tags?.[0];
  if (tag) {
    citations.push(
      parseCitation({
        ...common,
        id: 'c_livetag',
        title: `${tag.key}: ${tag.value}`.slice(0, 200),
        locator: {...base, focus: {type: 'tag', key: tag.key, value: tag.value}},
      })
    );
  }

  const user = event.user;
  if (user && (user.id || user.email || user.ip_address)) {
    citations.push(
      parseCitation({
        ...common,
        id: 'c_liveuser',
        title: 'Affected user',
        excerpt: [user.id && `id=${user.id}`, user.ip_address && `ip=${user.ip_address}`]
          .filter(Boolean)
          .join(', '),
        locator: {...base, focus: {type: 'context', key: 'user'}},
      })
    );
  }
  return citations.filter(isCitation);
}

/**
 * Builds a citation of every kind from real data in the signed-in organization,
 * using the same discovery queries the Seer embed stories use, so each kind's
 * detail renders its embed for real. Kinds the organization has no data for
 * fall back to nothing (fetching kinds) or the static example (the rest).
 */
export function useStoryCitations(): StoryCitations {
  const organization = useOrganization();

  const issueQuery = useQuery(recentIssueApiOptions(organization.slug));
  const issue = issueQuery.data?.[0];
  const eventQuery = useQuery({
    ...groupEventApiOptions({
      orgSlug: organization.slug,
      groupId: issue?.id ?? '',
      eventId: 'latest',
      environments: [],
    }),
    enabled: Boolean(issue),
    retry: false,
  });
  const traceQuery = useQuery(
    useTracesApiOptions({
      datetime: {period: '7d', start: null, end: null, utc: null},
      limit: 25,
      sort: '-timestamp',
    })
  );
  const replayQuery = useQuery(
    replayListApiOptions({
      options: {query: {sort: '-started_at'}},
      organization,
      queryReferrer: 'replayList',
    })
  );
  // Like the log embed story's query, plus the message for the citation's title,
  // and scoped to the issue's project once it is known.
  const logQuery = useQuery({
    ...apiOptions.as<EventsLogsResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        dataset: DiscoverDatasets.OURLOGS,
        field: [...AlwaysPresentLogFields, OurLogKnownFieldKey.MESSAGE],
        project: issue?.project?.id ? [issue.project.id] : [ALL_ACCESS_PROJECTS],
        sort: `-${OurLogKnownFieldKey.TIMESTAMP}`,
        statsPeriod: '7d',
        per_page: 25,
        referrer: 'seer-citation-story',
      },
      staleTime: Infinity,
    }),
    enabled: !issueQuery.isPending,
  });
  const profileQuery = useQuery(recentProfileApiOptions(organization.slug));

  const live: Partial<Record<CitationKind, Citation[]>> = {};
  const add = (kind: CitationKind, citations: Array<Citation | null>) => {
    const valid = citations.filter(isCitation);
    if (valid.length) {
      live[kind] = valid;
    }
  };

  if (issue) {
    add('issue', [
      parseCitation({
        id: 'c_liveissue',
        kind: 'issue',
        title: issue.shortId,
        excerpt: issue.title,
        projectId: issue.project?.id,
        locator: {groupId: issue.id, shortId: issue.shortId},
      }),
      parseCitation({
        id: 'c_liveusers',
        kind: 'issue',
        title: `${issue.shortId}: ${issue.userCount} users`,
        excerpt: `users: ${issue.userCount}`,
        projectId: issue.project?.id,
        locator: {
          groupId: issue.id,
          shortId: issue.shortId,
          stat: {name: 'users', value: issue.userCount},
        },
      }),
    ]);
    add('query', [
      parseCitation({
        id: 'c_livequery',
        kind: 'query',
        title: `Events and users for ${issue.shortId}, last 14 days`,
        locator: {
          dataset: 'errors',
          query: `issue:${issue.shortId}`,
          yAxes: ['count()', 'count_unique(user)'],
          statsPeriod: '14d',
          resultSummary: `count()=${issue.count}; count_unique(user)=${issue.userCount}`,
        },
      }),
    ]);
  }

  if (issue && eventQuery.data) {
    add('event', eventCitations(eventQuery.data, issue.id));
  }

  // Prefer data from the issue's project, so the story reads as one incident
  // rather than whatever the organization recorded last.
  const issueProjectSlug = issue?.project?.slug;
  const issueProjectId = issue?.project?.id;
  const traces = traceQuery.data?.data.filter(candidate => candidate.numSpans > 0) ?? [];
  const trace =
    traces.find(candidate => candidate.project === issueProjectSlug) ?? traces[0];
  if (trace) {
    add('trace', [
      parseCitation({
        id: 'c_livetrace',
        kind: 'trace',
        title: trace.name ? `${trace.name} (${trace.numSpans} spans)` : 'Trace',
        observedAt: new Date(trace.end).toISOString(),
        locator: {traceId: trace.trace},
      }),
    ]);
  }

  const replay = replayQuery.data?.data?.[0];
  if (replay) {
    const durationMs = (replay.duration?.asMilliseconds?.() ?? 0) || 0;
    add('replay', [
      parseCitation({
        id: 'c_livereplay',
        kind: 'replay',
        title: 'Moment in the most recent replay',
        observedAt: replay.started_at ? String(replay.started_at) : undefined,
        locator: {
          replayId: replay.id.replace(/-/g, ''),
          offsetMs: Math.min(5_000, Math.floor(durationMs / 2)),
          timestamp: replay.started_at
            ? new Date(replay.started_at).toISOString()
            : undefined,
        },
      }),
    ]);
  }

  const logs =
    logQuery.data?.data.filter(
      row => row[OurLogKnownFieldKey.TRACE_ID] && row[OurLogKnownFieldKey.PROJECT_ID]
    ) ?? [];
  const log =
    logs.find(row => String(row[OurLogKnownFieldKey.PROJECT_ID]) === issueProjectId) ??
    logs[0];
  if (log) {
    const identity = toIdentity(log);
    const message = String(log[OurLogKnownFieldKey.MESSAGE] ?? '');
    add('log', [
      parseCitation({
        id: 'c_livelog',
        kind: 'log',
        title: (message || 'Log line').slice(0, 200),
        excerpt: message || undefined,
        observedAt: identity.timestamp,
        projectId: identity.projectId,
        locator: {
          logId: identity.id,
          traceId: identity.traceId,
          timestamp: identity.timestamp,
        },
      }),
    ]);
  }

  const profileRow = profileQuery.data?.data?.[0];
  const profileId = profileRow?.['profile.id'];
  const projectSlug = profileRow?.['project.name'];
  if (typeof profileId === 'string' && profileId && typeof projectSlug === 'string') {
    add('profile', [
      parseCitation({
        id: 'c_liveprofile',
        kind: 'profile',
        title: `Profile ${profileId.slice(0, 8)}`,
        locator: {profileId, projectSlug},
      }),
    ]);
  }

  const pending: Partial<Record<CitationKind, boolean>> = {
    issue: issueQuery.isPending,
    query: issueQuery.isPending,
    event: issueQuery.isPending || (Boolean(issue) && eventQuery.isPending),
    trace: traceQuery.isPending,
    replay: replayQuery.isPending,
    log: logQuery.isPending,
    profile: profileQuery.isPending,
  };

  const sources = {} as Record<CitationKind, StoryCitationSource>;
  const citations: Citation[] = [];
  for (const kind of CITATION_KINDS) {
    const liveCitations = live[kind];
    if (liveCitations) {
      sources[kind] = 'live';
      citations.push(...liveCitations);
    } else if (SELF_CONTAINED.has(kind)) {
      sources[kind] = 'example';
      citations.push(...EXAMPLE_CITATIONS.filter(c => c.kind === kind));
    } else {
      sources[kind] = pending[kind] ? 'loading' : 'missing';
    }
  }
  return {citations, sources};
}
