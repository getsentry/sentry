import {getNodeAgentMonitoringOnboarding} from 'sentry/utils/gettingStartedDocs/node';

export const agentMonitoring = getNodeAgentMonitoringOnboarding({
  packageName: '@sentry/sveltekit',
  configFileName: 'instrumentation.server.js',
});
