import {getNodeAgentMonitoringOnboarding} from 'sentry/utils/gettingStartedDocs/node';

export const agentMonitoring = getNodeAgentMonitoringOnboarding({
  packageName: '@sentry/solidstart',
  configFileName: 'instrument.server.mjs',
});
