import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/javascript/agentMonitoring';
import {logsFullStack} from 'sentry/gettingStartedDocs/javascript/logs';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/metrics';
import {profilingFullStack} from 'sentry/gettingStartedDocs/javascript/profiling';

import {mcp} from './mcp';
import {onboarding, platformOptions, type PlatformOptions} from './onboarding';

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  profilingOnboarding: profilingFullStack({
    packageName: '@sentry/tanstackstart-react',
    browserProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/profiling/browser-profiling/',
    nodeProfilingLink:
      'https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/profiling/node-profiling/',
  }),
  agentMonitoringOnboarding: agentMonitoring({
    packageName: '@sentry/tanstackstart-react',
    clientConfigFileName: 'src/router.tsx',
    serverConfigFileName: 'app/ssr.tsx',
  }),
  logsOnboarding: logsFullStack({
    docsPlatform: 'tanstackstart-react',
    packageName: '@sentry/tanstackstart-react',
  }),
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'tanstackstart-react',
    packageName: '@sentry/tanstackstart-react',
  }),
  mcpOnboarding: mcp,
};

export default docs;
