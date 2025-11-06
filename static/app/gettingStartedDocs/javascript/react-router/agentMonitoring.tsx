import {getNodeAgentMonitoringOnboarding} from 'sentry/utils/gettingStartedDocs/node';

export const agentMonitoring = getNodeAgentMonitoringOnboarding({
  packageName: '@sentry/react-router',
  configFileName: 'instrument.server.mjs',
});
