import {Fragment} from 'react';

import {t, tct} from 'sentry/locale';
import {Project} from 'sentry/types';
import type {
  ErrorInfo,
  IssueCategoryConfigMapping,
  IssueTypeConfig,
} from 'sentry/utils/issueTypeConfig/types';
import {ErrorHelpType} from 'sentry/utils/issueTypeConfig/types';

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

const ErrorInfoChecks: Array<ErrorInfo> = [
  {
    errorTitle: 'ChunkLoadError',
    projectCheck: false,
    errorHelpType: ErrorHelpType.CHUNK_LOAD_ERROR,
  },
  {
    errorTitle: 'window is not defined',
    projectCheck: false,
    errorHelpType: ErrorHelpType.DOCUMENT_OR_WINDOW_OBJECT_ERROR,
  },
  {
    errorTitle: 'document is not defined',
    projectCheck: false,
    errorHelpType: ErrorHelpType.DOCUMENT_OR_WINDOW_OBJECT_ERROR,
  },
  {
    errorTitle: 'Invariant: attempted to hard navigate to the same URL',
    projectCheck: true,
    errorHelpType: ErrorHelpType.HANDLE_HARD_NAVIGATE_ERROR,
  },
  {
    errorTitle: "Module not found: Can't resolve",
    projectCheck: true,
    errorHelpType: ErrorHelpType.MODULE_NOT_FOUND,
  },
  {
    errorTitle: 'Dynamic server usage',
    projectCheck: true,
    errorHelpType: ErrorHelpType.DYNAMIC_SERVER_USAGE,
  },
  {
    errorTitle: 'TypeError: Load failed',
    projectCheck: false,
    errorHelpType: ErrorHelpType.LOAD_FAILED,
  },
  {
    errorTitle: 'socket hang up',
    projectCheck: false,
    errorHelpType: ErrorHelpType.SOCKET_HANG_UP,
  },
];

const errorHelpTypeResourceMap: Record<
  ErrorHelpType,
  Pick<IssueTypeConfig, 'resources'>
> = {
  [ErrorHelpType.CHUNK_LOAD_ERROR]: {
    resources: {
      // Not attempting translation
      description: (
        <Fragment>
          <b>ChunkLoadErrors</b> occur when the JavaScript chunks (bundles) that an
          application is trying to load encounter issues during the loading process. Some
          common causes are dynamic imports, version mismatching, and code splitting
          issues. To learn more about how to fix ChunkLoadErrors, check out the following:
        </Fragment>
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
  [ErrorHelpType.DOCUMENT_OR_WINDOW_OBJECT_ERROR]: {
    resources: {
      description: tct(
        '[errorTypes] occur when the global objects `window` or `document` are not defined. This typically happens in server-side rendering (SSR) or other non-browser environments. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Document/Window object errors</b>}
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
  [ErrorHelpType.HANDLE_HARD_NAVIGATE_ERROR]: {
    resources: {
      description: tct(
        '[errorTypes] occur in Next.js applications when trying to redirect to the same page. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Handle hard navigation errors</b>}
      ),
      links: [
        {
          text: t('Fixing handleHardNavigation errors in Next.js'),
          link: 'https://sentry.io/answers/handle-hard-navigation-errors-in-nextjs/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.MODULE_NOT_FOUND]: {
    resources: {
      description: tct(
        '[errorTypes] occur in Next.js applications when an imported module cannot be accessed. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Module not found errors</b>}
      ),
      links: [
        {
          text: t('Fixing "module not found" errors in Next.js'),
          link: 'https://sentry.io/answers/module-not-found-nextjs/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.DYNAMIC_SERVER_USAGE]: {
    resources: {
      description: tct(
        '[errorTypes] occur in Next.js applications when a route is statically generated, but uses dynamic server values at runtime. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Dynamic server usage errors</b>}
      ),
      links: [
        {
          text: t('Resolving "app/ Static to Dynamic Error" in Next.js'),
          link: 'https://nextjs.org/docs/messages/app-static-to-dynamic-error',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.LOAD_FAILED]: {
    resources: {
      description: tct(
        '[errorTypes] occur on Apple devices when there is an error with Fetch API.  To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Load Failed errors</b>}
      ),
      links: [
        {
          text: t('Fixing Load Failed errors in JavaScript'),
          link: 'https://sentry.io/answers/load-failed-javascript/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.SOCKET_HANG_UP]: {
    resources: {
      description: tct(
        '[errorTypes] occur when there is an error in a Fetch API call. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Socket hang up errors</b>}
      ),
      links: [
        {
          text: t('Fixing Socket Hang Up errors'),
          link: 'https://sentry.io/answers/socket-hang-up-javascript/',
        },
      ],
      linksByPlatform: {},
    },
  },
};

export function getErrorHelpResource({
  title,
  project,
}: {
  project: Project;
  title: string;
}): Pick<IssueTypeConfig, 'resources'> | null {
  for (const errorInfo of ErrorInfoChecks) {
    const {errorTitle, errorHelpType, projectCheck} = errorInfo;
    if (title.includes(errorTitle)) {
      if (projectCheck && !(project.platform || '').includes('nextjs')) {
        continue;
      }
      return errorHelpTypeResourceMap[errorHelpType];
    }
  }

  return null;
}
