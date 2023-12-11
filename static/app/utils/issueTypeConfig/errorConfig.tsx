import {t} from 'sentry/locale';
import type {
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

const enum ErrorHelpType {
  CHUNK_LOAD_ERROR = 'chunk_load_error',
  DOCUMENT_OR_WINDOW_OBJECT_ERROR = 'document_or_window_object_error',
}

const errorHelpTypeResourceMap: Record<
  ErrorHelpType,
  Pick<IssueTypeConfig, 'resources'>
> = {
  [ErrorHelpType.CHUNK_LOAD_ERROR]: {
    resources: {
      // Not attempting translation
      description: `While we hoped to fill this page with tons of useful info...we'll cut to the chase and
provide some high level context that's likely more helpful for this error type.
ChunkLoadErrors occur when the JavaScript chunks (bundles) that an application is trying to
load encounter issues during the loading process. Some common causes are dynamic imports,
version mismatching, and code splitting issues. To learn more about how to fix ChunkLoadErrors,
check out the following:`,
      links: [
        {
          text: t('How to fix ChunkLoadErrors'),
          link: 'https://sentry.io/answers/chunk-load-errors-javascript/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.DOCUMENT_OR_WINDOW_OBJECT_ERROR]: {
    resources: {
      description: t(
        'Document/Window object errors occur when the global objects `window` or `document` are not defined. This typically happens in server-side rendering (SSR) or other non-browser environments. To learn more about how to fix these errors, check out these resources:'
      ),
      links: [
        {
          text: t('How to fix Document/Window Object Error'),
          link: 'https://sentry.io/answers/window-is-not-defined/',
        },
      ],
      linksByPlatform: {},
    },
  },
};

export function getErrorHelpResource(
  title: string
): Pick<IssueTypeConfig, 'resources'> | null {
  if (title.includes('ChunkLoadError')) {
    return errorHelpTypeResourceMap[ErrorHelpType.CHUNK_LOAD_ERROR];
  }
  if (
    title.includes('window is not defined') ||
    title.includes('document is not defined')
  ) {
    return errorHelpTypeResourceMap[ErrorHelpType.DOCUMENT_OR_WINDOW_OBJECT_ERROR];
  }

  return null;
}
