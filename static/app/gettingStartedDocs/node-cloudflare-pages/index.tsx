import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {agentMonitoring} from './agentMonitoring';
import {crashReport} from './crashReport';
import {logs} from './logs';
import {mcp} from './mcp';
import {metrics} from './metrics';
import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReport,
  logsOnboarding: logs,
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
  metricsOnboarding: metrics,
};

export default docs;
