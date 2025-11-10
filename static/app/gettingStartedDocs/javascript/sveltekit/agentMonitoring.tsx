import {getNodeAgentMonitoringOnboarding} from 'sentry/gettingStartedDocs/node/node/utils';

export const agentMonitoring = getNodeAgentMonitoringOnboarding({
  packageName: '@sentry/sveltekit',
  configFileName: 'instrumentation.server.js',
});
