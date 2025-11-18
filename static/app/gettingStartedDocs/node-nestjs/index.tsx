import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {logs} from './logs';
import {mcp} from './mcp';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: feedback,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
};

export default docs;
