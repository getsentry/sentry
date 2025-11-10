import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/python/agentMonitoring';
import {crashReport} from 'sentry/gettingStartedDocs/python/python/crashReport';
import {logs} from 'sentry/gettingStartedDocs/python/python/logs';
import {mcp} from 'sentry/gettingStartedDocs/python/python/mcp';
import {profiling} from 'sentry/gettingStartedDocs/python/python/profiling';

import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling(),
  agentMonitoringOnboarding: agentMonitoring,
  mcpOnboarding: mcp,
  logsOnboarding: logs(),
};

export default docs;
