import {Fragment} from 'react';

import {t, tct} from 'sentry/locale';
import type {PlatformKey, Project} from 'sentry/types/project';
import type {
  IssueCategoryConfigMapping,
  IssueTypeConfig,
} from 'sentry/utils/issueTypeConfig/types';
import {ErrorHelpType} from 'sentry/utils/issueTypeConfig/types';
import isHydrationError from 'sentry/utils/react/isHydrationError';

export const errorConfig: IssueCategoryConfigMapping = {
  _categoryDefaults: {
    actions: {
      archiveUntilOccurrence: {enabled: true},
      delete: {enabled: true},
      deleteAndDiscard: {enabled: true},
      ignore: {enabled: true},
      merge: {enabled: true},
      resolve: {enabled: true},
      resolveInRelease: {enabled: true},
      share: {enabled: true},
    },
    attachments: {enabled: true},
    autofix: true,
    mergedIssues: {enabled: true},
    replays: {enabled: true},
    similarIssues: {enabled: true},
    userFeedback: {enabled: true},
    usesIssuePlatform: false,
    issueSummary: {enabled: true},
  },
};

type ErrorInfo = {
  errorHelpType: ErrorHelpType;
  errorTitle: string | RegExp | ((title: string) => boolean);
  projectPlatforms: PlatformKey[];
};

const ErrorInfoChecks: Array<ErrorInfo> = [
  {
    errorTitle: 'ChunkLoadError',
    projectPlatforms: ['javascript'],
    errorHelpType: ErrorHelpType.CHUNK_LOAD_ERROR,
  },
  {
    errorTitle: /(window is not defined|document is not defined)/i,
    projectPlatforms: ['javascript'],
    errorHelpType: ErrorHelpType.DOCUMENT_OR_WINDOW_OBJECT_ERROR,
  },
  {
    errorTitle: 'Invariant: attempted to hard navigate to the same URL',
    projectPlatforms: ['javascript-nextjs'],
    errorHelpType: ErrorHelpType.HANDLE_HARD_NAVIGATE_ERROR,
  },
  {
    errorTitle: "Module not found: Can't resolve",
    projectPlatforms: ['javascript-nextjs'],
    errorHelpType: ErrorHelpType.MODULE_NOT_FOUND,
  },
  {
    errorTitle: 'Dynamic server usage',
    projectPlatforms: ['javascript-nextjs'],
    errorHelpType: ErrorHelpType.DYNAMIC_SERVER_USAGE,
  },
  {
    errorTitle: isHydrationError,
    projectPlatforms: ['javascript-nextjs'],
    errorHelpType: ErrorHelpType.HYDRATION_ERROR,
  },
  {
    errorTitle: 'TypeError: Load failed',
    projectPlatforms: ['javascript'],
    errorHelpType: ErrorHelpType.LOAD_FAILED,
  },
  {
    errorTitle: 'Failed to fetch',
    projectPlatforms: ['javascript'],
    errorHelpType: ErrorHelpType.FAILED_TO_FETCH,
  },
  {
    errorTitle: 'socket hang up',
    projectPlatforms: ['javascript'],
    errorHelpType: ErrorHelpType.SOCKET_HANG_UP,
  },
  {
    errorTitle: 'Error: NextRouter was not mounted',
    projectPlatforms: ['javascript-nextjs'],
    errorHelpType: ErrorHelpType.NEXTJS_ROUTER_NOT_MOUNTED,
  },
  {
    errorTitle: 'UnboundLocalError',
    projectPlatforms: ['python'],
    errorHelpType: ErrorHelpType.UNBOUND_LOCAL_ERROR,
  },
  {
    errorTitle: 'Error: Cannot find module',
    projectPlatforms: ['node'],
    errorHelpType: ErrorHelpType.NODEJS_CANNOT_FIND_MODULE,
  },
  {
    errorTitle: 'ImportError: No module named',
    projectPlatforms: ['python'],
    errorHelpType: ErrorHelpType.NO_MODULE_NAMED,
  },
  {
    errorTitle: "TypeError: 'str' object does not support item assignment",
    projectPlatforms: ['python'],
    errorHelpType: ErrorHelpType.STRINGS_ARE_IMMUTABLE,
  },
  {
    errorTitle: 'Invariant Violation',
    projectPlatforms: ['javascript', 'react'],
    errorHelpType: ErrorHelpType.INVARIANT_VIOLATION_ERROR,
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
  [ErrorHelpType.HYDRATION_ERROR]: {
    resources: {
      description: tct(
        '[errorTypes] occur in React based applications when the server-rendered HTML does not match what is expected on the client. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Hydration Errors</b>}
      ),
      links: [
        {
          text: t('Resolving Hydration Errors'),
          link: 'https://sentry.io/answers/hydration-error-nextjs/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.LOAD_FAILED]: {
    resources: {
      description: tct(
        '[errorTypes] occur on Apple devices when there is an error with Fetch API. To learn more about how to fix these errors, check out these resources:',
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
  [ErrorHelpType.FAILED_TO_FETCH]: {
    resources: {
      description: tct(
        '[errorTypes] occur when there is an error with Fetch API. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Failed to Fetch errors</b>}
      ),
      links: [
        {
          text: t('Fixing Failed to Fetch errors in JavaScript'),
          link: 'https://sentry.io/answers/failed-to-fetch-javascript/',
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
  [ErrorHelpType.NEXTJS_ROUTER_NOT_MOUNTED]: {
    resources: {
      description: tct(
        '[errorTypes] occur in Next.js applications when the useRouter hook is used incorrectly. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>NextRouter not mounted errors</b>}
      ),
      links: [
        {
          text: t('Fixing "NextRouter was not mounted" errors in Next.js'),
          link: 'https://sentry.io/answers/error-nextrouter-was-not-mounted/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.UNBOUND_LOCAL_ERROR]: {
    resources: {
      description: tct(
        '[errorTypes] occur in Python applications when a variable is defined in both global and local contexts. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>UnboundLocalError errors</b>}
      ),
      links: [
        {
          text: t('Fixing "UnboundLocalError" errors in Python'),
          link: 'https://sentry.io/answers/unbound-local-error/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.NODEJS_CANNOT_FIND_MODULE]: {
    resources: {
      description: tct(
        '[errorTypes] occur in Node.js applications when an imported module cannot be found. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Cannot find module errors</b>}
      ),
      links: [
        {
          text: t('Fixing "Cannot find module" errors in Node.js'),
          link: 'http://sentry.io/answers/how-do-i-resolve-cannot-find-module-error-using-node-js/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.NO_MODULE_NAMED]: {
    resources: {
      description: tct(
        '[errorTypes] occur in Python applications when a module that does not exist is imported. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>No module named errors</b>}
      ),
      links: [
        {
          text: t('Fixing "ImportError: No module named" errors in Python'),
          link: 'https://sentry.io/answers/resolve-python-importerror-no-module-named/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.STRINGS_ARE_IMMUTABLE]: {
    resources: {
      description: tct(
        '[errorTypes] occur in Python applications when a string is modified in place. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Strings do not support item assignment errors</b>}
      ),
      links: [
        {
          text: t(
            'Fixing "\'str\' object does not support item assignment" errors in Python'
          ),
          link: 'https://sentry.io/answers/strings-are-immutable/',
        },
      ],
      linksByPlatform: {},
    },
  },
  [ErrorHelpType.INVARIANT_VIOLATION_ERROR]: {
    resources: {
      description: tct(
        '[errorTypes] occur in React when modules are imported incorrectly. To learn more about how to fix these errors, check out these resources:',
        {errorTypes: <b>Invariant violation errors</b>}
      ),
      links: [
        {
          text: t(
            'Fixing "Invariant Violation: Element type is invalid" errors in React'
          ),
          link: 'https://sentry.io/answers/uncaught-error-invariant-violation-element-type-is-invalid/',
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
    const {errorTitle, errorHelpType, projectPlatforms} = errorInfo;
    const shouldShowCustomResource =
      typeof errorTitle === 'string'
        ? title.includes(errorTitle)
        : errorTitle instanceof RegExp
          ? errorTitle.test(title)
          : errorTitle(title);

    if (shouldShowCustomResource) {
      // Issues without a platform will never have a custom "Sentry Answers" resource
      for (const platform of projectPlatforms) {
        const isCorrectPlatform = (project.platform || '').includes(platform);
        if (isCorrectPlatform) {
          return errorHelpTypeResourceMap[errorHelpType];
        }
      }
    }
  }
  return null;
}
