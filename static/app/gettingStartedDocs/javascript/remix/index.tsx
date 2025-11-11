import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/javascript/featureFlag';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/javascript/metrics';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {logs} from './logs';
import {onboarding} from './onboarding';
import {profiling} from './profiling';
import {replay} from './replay';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  crashReportOnboarding: crashReport,
  featureFlagOnboarding: featureFlag,
  profilingOnboarding: profiling,
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'remix',
    packageName: '@sentry/remix',
  }),
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logs,
};

export default docs;
