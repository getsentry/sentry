import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {feedback} from 'sentry/gettingStartedDocs/dotnet/feedback';
import {logs} from 'sentry/gettingStartedDocs/dotnet/logs';
import {metrics} from 'sentry/gettingStartedDocs/dotnet/metrics';
import type {DotNetSdkPackage} from 'sentry/gettingStartedDocs/dotnet/utils';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

const sdkPackage: DotNetSdkPackage = {
  name: 'Sentry.Google.Cloud.Functions',
  registryKey: 'sentry.dotnet.google-cloud-function',
};

export const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: crashReport,
  logsOnboarding: logs({logger: 'logger', sdkPackage, appSettingsOnly: true}),
  metricsOnboarding: metrics({hostInitializesSdk: true, sdkPackage}),
};
