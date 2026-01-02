import {getNodeAgentMonitoringOnboarding} from 'sentry/gettingStartedDocs/node/utils';

export const agentMonitoring = getNodeAgentMonitoringOnboarding({
  packageName: '@sentry/remix',
  configFileName: 'instrument.server.mjs',
});
