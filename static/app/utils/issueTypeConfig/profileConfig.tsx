import {t} from 'sentry/locale';
import {IssueType} from 'sentry/types';
import {IssueCategoryConfigMapping} from 'sentry/utils/issueTypeConfig/types';

const profileConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      delete: {
        enabled: false,
        disabledReason: t('Not yet supported for profile issues'),
      },
      deleteAndDiscard: {
        enabled: false,
        disabledReason: t('Not yet supported for profile issues'),
      },
      merge: {
        enabled: false,
        disabledReason: t('Not yet supported for profile issues'),
      },
      ignore: {enabled: true},
      share: {enabled: true},
    },
    attachments: {enabled: false},
    grouping: {enabled: false},
    mergedIssues: {enabled: false},
    replays: {enabled: false},
    similarIssues: {enabled: false},
    userFeedback: {enabled: false},
    // Renders `ProfileEventEvidence` instead
    evidence: null,
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
};

export default profileConfig;
