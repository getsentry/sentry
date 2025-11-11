import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/javascript/featureFlag';
import {metrics} from 'sentry/gettingStartedDocs/javascript/javascript/metrics';
import {logs} from 'sentry/gettingStartedDocs/javascript/react/logs';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {profiling} from './profiling';
import {replay} from './replay';
import {installSnippetBlock} from './utils';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  performanceOnboarding: performance,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
  featureFlagOnboarding: featureFlag,
  metricsOnboarding: metrics({
    installSnippetBlock,
    docsPlatform: 'react',
    packageName: '@sentry/react',
  }),
};

export default docs;
