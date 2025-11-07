import {getNodeAgentMonitoringOnboarding} from 'sentry/gettingStartedDocs/node/node/utils';

export const agentMonitoring = getNodeAgentMonitoringOnboarding({
  packageName: '@sentry/remix',
  configFileName: 'instrument.server.mjs',
});
