import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

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
};

export default docs;
