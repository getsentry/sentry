import {getNodeAgentMonitoringOnboarding} from 'sentry/utils/gettingStartedDocs/node';

export const agentMonitoring = getNodeAgentMonitoringOnboarding({
  packageName: '@sentry/remix',
  configFileName: 'instrument.server.mjs',
});
