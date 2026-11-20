import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logs} from 'sentry/gettingStartedDocs/dotnet/logs';
import {metrics} from 'sentry/gettingStartedDocs/dotnet/metrics';
import type {DotNetSdkPackage} from 'sentry/gettingStartedDocs/dotnet/utils';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

const sdkPackage: DotNetSdkPackage = {
  name: 'Sentry.AspNet',
  registryKey: 'sentry.dotnet.aspnet',
};

export const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  crashReportOnboarding: crashReport,
  feedbackOnboardingJsLoader,
  logsOnboarding: logs({sdkPackage}),
  metricsOnboarding: metrics({sdkPackage}),
};
