import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {agentMonitoring} from './agentMonitoring';
import {logs} from './logs';
import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  profilingOnboarding: profiling,
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logs,
};

export default docs;
