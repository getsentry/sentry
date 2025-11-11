import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/python/python/agentMonitoring';
import {crashReport} from 'sentry/gettingStartedDocs/python/python/crashReport';
import {logs} from 'sentry/gettingStartedDocs/python/python/logs';
import {profiling} from 'sentry/gettingStartedDocs/python/python/profiling';

import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  profilingOnboarding: profiling({basePackage: 'sentry-sdk[rq]'}),
  crashReportOnboarding: crashReport,
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logs({
    packageName: 'sentry-sdk[rq]',
  }),
};

export default docs;
