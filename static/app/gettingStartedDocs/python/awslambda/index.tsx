import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/python/agentMonitoring';
import {crashReport} from 'sentry/gettingStartedDocs/python/python/crashReport';
import {logs} from 'sentry/gettingStartedDocs/python/python/logs';

import {onboarding, profilingOnboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReport,
  profilingOnboarding,
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logs(),
};

export default docs;

