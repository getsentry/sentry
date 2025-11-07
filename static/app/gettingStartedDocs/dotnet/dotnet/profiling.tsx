import {getDotnetProfilingOnboarding} from 'sentry/utils/gettingStartedDocs/dotnet';

import {getInstallSnippetCoreCli, getInstallSnippetPackageManager} from './onboarding';

export const profiling = getDotnetProfilingOnboarding({
  getInstallSnippetPackageManager,
  getInstallSnippetCoreCli,
});
