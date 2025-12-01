import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/featureFlag';
import {logsFullStack} from 'sentry/gettingStartedDocs/javascript/logs';
import {metricsFullStack} from 'sentry/gettingStartedDocs/javascript/metrics';
import {profiling} from 'sentry/gettingStartedDocs/javascript/profiling';

import {agentMonitoring} from './agentMonitoring';
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
  featureFlagOnboarding: featureFlag,
  profilingOnboarding: profiling({
    installSnippetBlock,
    docsLink:
      'https://docs.sentry.io/platforms/javascript/guides/solidstart/profiling/browser-profiling/',
  }),
  agentMonitoringOnboarding: agentMonitoring,
  logsOnboarding: logsFullStack({
    docsPlatform: 'solidstart',
    packageName: '@sentry/solidstart',
  }),
  metricsOnboarding: metricsFullStack({
    docsPlatform: 'solidstart',
    packageName: '@sentry/solidstart',
  }),
  mcpOnboarding: mcp,
};

export default docs;
