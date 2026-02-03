import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/javascript/agentMonitoring';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/featureFlag';
import {logsFullStack} from 'sentry/gettingStartedDocs/javascript/logs';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/metrics';
import {profiling} from 'sentry/gettingStartedDocs/javascript/profiling';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {mcp} from './mcp';
import {onboarding} from './onboarding';
import {replay} from './replay';
import {installSnippetBlock} from './utils';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling({
    installSnippetBlock,
    docsLink:
      'https://docs.sentry.io/platforms/javascript/guides/nuxt/profiling/browser-profiling/',
  }),
  featureFlagOnboarding: featureFlag,
  logsOnboarding: logsFullStack({
    docsPlatform: 'nuxt',
    packageName: '@sentry/nuxt',
  }),
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'nuxt',
    packageName: '@sentry/nuxt',
  }),
  agentMonitoringOnboarding: agentMonitoring({
    packageName: '@sentry/nuxt',
    clientConfigFileName: 'sentry.client.config.(ts|js)',
    serverConfigFileName: 'sentry.server.config.(ts|js)',
  }),
  mcpOnboarding: mcp,
};

export default docs;
