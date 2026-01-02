import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/featureFlag';
import {logs} from 'sentry/gettingStartedDocs/javascript/logs';
import {metrics} from 'sentry/gettingStartedDocs/javascript/metrics';
import {profiling} from 'sentry/gettingStartedDocs/javascript/profiling';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {onboarding} from './onboarding';
import {replay} from './replay';
import {installSnippetBlock, platformOptions, type PlatformOptions} from './utils';

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling({
    installSnippetBlock,
    docsLink:
      'https://docs.sentry.io/platforms/javascript/guides/vue/profiling/browser-profiling/',
  }),
  featureFlagOnboarding: featureFlag,
  logsOnboarding: logs({
    installSnippetBlock,
    docsPlatform: 'vue',
    packageName: '@sentry/vue',
  }),
  metricsOnboarding: metrics({
    installSnippetBlock,
    docsPlatform: 'vue',
    packageName: '@sentry/vue',
  }),
  agentMonitoringOnboarding: agentMonitoring,
};

export default docs;
