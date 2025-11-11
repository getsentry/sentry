import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/python/agentMonitoring';
import {crashReport} from 'sentry/gettingStartedDocs/python/python/crashReport';
import {logs} from 'sentry/gettingStartedDocs/python/python/logs';
import {metrics} from 'sentry/gettingStartedDocs/python/python/metrics';

import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logs(),
  metricsOnboarding: metrics(),
};

export default docs;
