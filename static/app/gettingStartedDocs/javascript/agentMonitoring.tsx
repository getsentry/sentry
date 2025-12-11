import {getNodeAgentMonitoringOnboarding} from 'sentry/gettingStartedDocs/node/utils';

export const getBrowserAgentMonitoringOnboarding = getNodeAgentMonitoringOnboarding;

export const agentMonitoring = getNodeAgentMonitoringOnboarding({
  packageName: '@sentry/browser',
  importMode: 'esm-only',
});
