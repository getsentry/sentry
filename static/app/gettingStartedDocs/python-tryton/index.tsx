import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/agentMonitoring';
import {crashReport} from 'sentry/gettingStartedDocs/python/crashReport';
import {logs} from 'sentry/gettingStartedDocs/python/logs';
import {mcp} from 'sentry/gettingStartedDocs/python/mcp';
import {metrics} from 'sentry/gettingStartedDocs/python/metrics';

import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  profilingOnboarding: profiling,
  crashReportOnboarding: crashReport,
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
  logsOnboarding: logs(),
  metricsOnboarding: metrics(),
};

export default docs;
