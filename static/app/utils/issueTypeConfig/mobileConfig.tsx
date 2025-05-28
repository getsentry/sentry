import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types/group';
import type {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';
import {Tab} from 'sentry/views/issueDetails/types';

const mobileConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for mobile issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for mobile issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not yet supported for mobile issues'),
      },
      ignore: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {enabled: true},
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
      replays: {enabled: true},
      tagsTab: {enabled: true},
    },
    autofix: true,
    mergedIssues: {enabled: false},
    similarIssues: {enabled: false},
    stacktrace: {enabled: false},
    spanEvidence: {enabled: true},
    // Should render a custom SpanEvidence component
    evidence: null,
    usesIssuePlatform: true,
    issueSummary: {enabled: true},
  },
  [IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD]: {
    resources: {
      description: t('File IO operations on your main thread may lead to app hangs.'),
      links: [
        {
          text: t('Sentry Docs: File IO on the Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/file-main-thread-io/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PERFORMANCE_DB_MAIN_THREAD]: {
    resources: {
      description: t('Database operations on your main thread may lead to app hangs.'),
      links: [
        {
          text: t('Sentry Docs: Database on the Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/db-main-thread-io/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_FILE_IO_MAIN_THREAD]: {
    resources: {
      description: t(
        'File I/O can be a long running operation that blocks the main thread. This may result in app hangs and poor UI performance. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('File I/O on Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/main-thread-io/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_JSON_DECODE_MAIN_THREAD]: {
    resources: {
      description: t(
        'Decoding a JSON blob can be a long running operation that blocks the main thread. This may result in app hangs and poor UI performance. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('JSON Decode on Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/json-decoding-main-thread/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_IMAGE_DECODE_MAIN_THREAD]: {
    resources: {
      description: t(
        'Decoding a compressed image (e.g. JPEG, PNG) into a bitmap can be a long running operation that blocks the main thread. This may result in app hangs and poor UI performance. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('Image Decode on Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/image-decoding-main-thread/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_REGEX_MAIN_THREAD]: {
    resources: {
      description: t(
        'Evaluating matches between strings and regular expressions (regex) can be long-running operations that may impact app responsiveness. This may result in app hangs and poor UI performance. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('Regex on Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/regex-main-thread/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [IssueType.PROFILE_FRAME_DROP]: {
    resources: {
      description: t(
        'The main (or UI) thread in a mobile app is responsible for handling all user interaction and needs to be able to respond to gestures and taps in real time. If a long-running operation blocks the main thread, the app becomes unresponsive, impacting the quality of the user experience. To learn more, read our documentation:'
      ),
      links: [
        {
          text: t('Frame Drop'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/frame-drop/',
        },
      ],
      linksByPlatform: {},
    },
  },
};

export default mobileConfig;
