import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {featureFlag} from './featureFlag';
import {logs} from './logs';
import {mcp} from './mcp';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  performanceOnboarding: performance,
  crashReportOnboarding: crashReport,
  featureFlagOnboarding: featureFlag,
  profilingOnboarding: profiling({traceLifecycle: 'manual'}),
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
  logsOnboarding: logs(),
};

export default docs;
