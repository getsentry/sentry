import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/javascript/metrics';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {logs} from './logs';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {profiling} from './profiling';
import {replay} from './replay';

const docs: Docs = {
  onboarding,
  replayOnboarding: replay,
  feedbackOnboardingNpm: feedback,
  crashReportOnboarding: crashReport,
  performanceOnboarding: performance,
  profilingOnboarding: profiling,
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logs,
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'react-router',
    packageName: '@sentry/react-router',
  }),
};

export default docs;
