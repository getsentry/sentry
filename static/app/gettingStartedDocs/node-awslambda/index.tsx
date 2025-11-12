import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {logs} from './logs';
import {mcp} from './mcp';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {profiling} from './profiling';
import {platformOptions, type PlatformOptions} from './utils';

const docs: Docs<PlatformOptions> = {
  onboarding,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
  platformOptions,
  metricsOnboarding: metrics,
};

export default docs;
