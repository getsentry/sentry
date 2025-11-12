import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logsFullStack} from 'sentry/gettingStartedDocs/javascript/javascript/logs';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/javascript/metrics';
import {profilingFullStack} from 'sentry/gettingStartedDocs/javascript/javascript/profiling';

import {agentMonitoring} from './agentMonitoring';
import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  profilingOnboarding: profilingFullStack({
    packageName: '@sentry/tanstackstart-react',
    browserProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/profiling/browser-profiling/',
    nodeProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/profiling/node-profiling/',
  }),
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logsFullStack({
    docsPlatform: 'tanstackstart-react',
    packageName: '@sentry/tanstackstart-react',
  }),
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'tanstackstart-react',
    packageName: '@sentry/tanstackstart-react',
  }),
};

export default docs;
