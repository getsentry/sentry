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
        'I/O operations on the UI thread can cause jank and lead to frame drops that are distracting. If long enough, these blocking operations can cause Application Not Responding dialogs that will cause the app to crash. To learn more about how to fix calls that block the main thread, check out these resources:'
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
        'Decoding a JSON blob into a data structure can be a long running operation, especially for large blobs, and can cause frames to drop or the app to crash. To learn more about how to fix calls that block the main thread, check out these resources:'
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
        'Decoding a compressed image from a format such as JPEG or PNG into a bitmap can be a long running operation, especially for large images, and can cause frames to drop or the app to crash. To learn more about how to fix calls that block the main thread, check out these resources:'
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
