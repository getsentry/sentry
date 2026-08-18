import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

export const genAiConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {enabled: true},
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for Gen AI issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not yet supported for Gen AI issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {
        enabled: false,
        disabledReason: t('Gen AI issues are not associated with a release'),
      },
      share: {enabled: true},
    },
    pages: {
      landingPage: Tab.DETAILS,
      events: {enabled: true},
      openPeriods: {enabled: false},
      checkIns: {enabled: false},
      uptimeChecks: {enabled: false},
      attachments: {enabled: false},
      userFeedback: {enabled: false},
      replays: {enabled: false},
      tagsTab: {enabled: false},
    },
    // Occurrences are synthesized from aggregated span data. There is no stack
    // trace and no span tree, so Seer has nothing to reason about.
    autofix: false,
    issueSummary: {enabled: false},
    stacktrace: {enabled: false},
    spanEvidence: {enabled: false},
    // The detector attaches a fully populated evidence_display to every occurrence.
    evidence: {title: t('Cache Usage')},
    // Fingerprints are chosen by the detector, so grouping variants say nothing useful.
    groupingInfo: {enabled: false},
    // Synthesized occurrences are not queryable in Discover.
    discover: {enabled: false},
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    usesIssuePlatform: true,
  },
  [IssueType.LLM_CACHE_USAGE]: {
    // The issue page renders the finding itself, so the generic evidence table
    // would repeat it as an unordered list of numbers. The category default
    // keeps that table for surfaces that resolve config without a group.
    evidence: null,
    header: {
      // One occurrence per open period, so an occurrence histogram is a single
      // bar. The cache activity chart in the body is the graph worth showing.
      graph: {enabled: false},
      filterBar: {enabled: false},
      eventNavigation: {enabled: false},
      tagDistribution: {enabled: false},
      occurrenceSummary: {enabled: false},
    },
    // One synthesized event, no users.
    eventAndUserCounts: {enabled: false},
    // The only tags are the transaction and the model, both of which the
    // Problem section already shows as first-class rows.
    tags: {enabled: false},
    contexts: {enabled: false},
    // The trace preview locates a trace by the event's timestamp, which here is
    // detection time rather than the time of the sampled call. Example Calls
    // links to the traces with their own timestamps instead.
    trace: {enabled: false},
    resources: {
      description: t(
        'Prompt caching lets a provider re-use the unchanging start of a prompt across calls, billed at a fraction of the normal input rate. It only engages when that prefix is byte-identical every time, so small amounts of per-call content near the top of a prompt can quietly disable it.'
      ),
      links: [
        {
          text: t('Sentry Docs: AI Agents'),
          link: 'https://docs.sentry.io/product/insights/agents/',
        },
      ],
      linksByPlatform: {},
    },
  },
};
