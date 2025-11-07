import {getDotnetProfilingOnboarding} from 'sentry/utils/gettingStartedDocs/dotnet';

import {getInstallSnippetCoreCli, getInstallSnippetPackageManager} from './utils';

export const profiling = getDotnetProfilingOnboarding({
  getInstallSnippetPackageManager,
  getInstallSnippetCoreCli,
});
