import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/javascript/featureFlag';
import {logs} from 'sentry/gettingStartedDocs/javascript/javascript/logs';
import {metrics} from 'sentry/gettingStartedDocs/javascript/javascript/metrics';
import {profiling} from 'sentry/gettingStartedDocs/javascript/javascript/profiling';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {replay} from './replay';
import {installSnippetBlock} from './utils';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  performanceOnboarding: performance,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling({
    installSnippetBlock,
    docsLink:
      'https://docs.sentry.io/platforms/javascript/guides/react/profiling/browser-profiling/',
  }),
  logsOnboarding: logs({
    installSnippetBlock,
    docsPlatform: 'react',
    packageName: '@sentry/react',
  }),
  featureFlagOnboarding: featureFlag,
  metricsOnboarding: metrics({
    installSnippetBlock,
    docsPlatform: 'react',
    packageName: '@sentry/react',
  }),
};

export default docs;
