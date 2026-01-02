import {getNodeAgentMonitoringOnboarding} from 'sentry/gettingStartedDocs/node/utils';

export const agentMonitoring = getNodeAgentMonitoringOnboarding({
  packageName: '@sentry/sveltekit',
  configFileName: 'instrumentation.server.js',
});
