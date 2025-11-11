import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader/jsLoader';

import {crashReport} from './crashReport';
import {featureFlag} from './featureFlag';
import {feedback} from './feedback';
import {logs} from './logs';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {profiling} from './profiling';
import {replay} from './replay';
import {installSnippetBlock, platformOptions, type PlatformOptions} from './utils';

const docs: Docs<PlatformOptions> = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  feedbackOnboardingJsLoader,
  replayOnboarding: replay,
  replayOnboardingJsLoader,
  performanceOnboarding: performance,
  crashReportOnboarding: crashReport,
  platformOptions,
  profilingOnboarding: profiling,
  featureFlagOnboarding: featureFlag,
  logsOnboarding: logs,
  metricsOnboarding: metrics({
    installSnippetBlock,
    docsPlatform: 'javascript',
    packageName: '@sentry/browser',
  }),
};

export default docs;
