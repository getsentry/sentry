import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/javascript/metrics';

import {agentMonitoring} from './agentMonitoring';
import {logs} from './logs';
import {onboarding} from './onboarding';
import {profiling} from './profiling';

const docs: Docs = {
  onboarding,
  profilingOnboarding: profiling,
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logs,
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'tanstackstart-react',
    packageName: '@sentry/tanstackstart-react',
  }),
};

export default docs;
