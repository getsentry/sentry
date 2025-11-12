import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/python/agentMonitoring';
import {crashReport} from 'sentry/gettingStartedDocs/python/python/crashReport';
import {logs} from 'sentry/gettingStartedDocs/python/python/logs';
import {mcp} from 'sentry/gettingStartedDocs/python/python/mcp';
import {metrics} from 'sentry/gettingStartedDocs/python/python/metrics';
import {profiling} from 'sentry/gettingStartedDocs/python/python/profiling';

import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  profilingOnboarding: profiling(),
  crashReportOnboarding: crashReport,
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
  logsOnboarding: logs(),
  metricsOnboarding: metrics(),
};

export default docs;
