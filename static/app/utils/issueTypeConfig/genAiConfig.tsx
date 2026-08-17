import {t} from 'sentry/locale';
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
};
