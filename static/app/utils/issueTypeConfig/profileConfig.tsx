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
          text: t('File IO on Main Thread'),
          link: 'https://docs.sentry.io/product/issues/issue-details/performance-issues/main-thread-io/',
        },
      ],
      linksByPlatform: {},
    },
  },
};

export default profileConfig;
