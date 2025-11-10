import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getPythonLogsOnboarding,
  getPythonProfilingOnboarding,
} from 'sentry/utils/gettingStartedDocs/python';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {featureFlag} from './featureFlag';
import {mcp} from './mcp';
import {onboarding} from './onboarding';
import {performance} from './performance';

const docs: Docs = {
  onboarding,
  performanceOnboarding: performance,
  crashReportOnboarding: crashReport,
  featureFlagOnboarding: featureFlag,
  profilingOnboarding: getPythonProfilingOnboarding({traceLifecycle: 'manual'}),
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
  logsOnboarding: getPythonLogsOnboarding(),
};

export default docs;
