import {t} from 'sentry/locale';
import {ErrorType} from 'sentry/types';
import {
  IssueCategoryConfigMapping,
  IssueTypeConfig,
} from 'sentry/utils/issueTypeConfig/types';

export const errorConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {enabled: true},
      deleteAndDiscard: {enabled: true},
      ignore: {enabled: true},
      merge: {enabled: true},
      resolveInRelease: {enabled: true},
      share: {enabled: true},
    },
    attachments: {enabled: true},
    mergedIssues: {enabled: true},
    replays: {enabled: true},
    similarIssues: {enabled: true},
    userFeedback: {enabled: true},
    usesIssuePlatform: false,
  },
};

export const errorTypeConfigMap: Record<ErrorType, Partial<IssueTypeConfig>> = {
  [ErrorType.CHUNK_LOAD_ERROR]: {
    resources: {
      description: t(
        'ChunkLoadErrors occur when the JavaScript chunks (bundles) that an application is trying to load encounter issues during the loading process. Some common causes are dynamic imports, version mismatching, and code splitting issues. To learn more about how to fix ChunkLoadErrors, check out these resources:'
      ),
      links: [
        {
          text: t('How to fix ChunkLoadErrors'),
          link: 'https://sentry.io/answers/chunk-load-errors-javascript/',
        },
      ],
      linksByPlatform: {},
    },
  },
};
