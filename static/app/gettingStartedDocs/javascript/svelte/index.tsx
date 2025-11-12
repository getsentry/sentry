import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/javascript/featureFlag';
import {logs} from 'sentry/gettingStartedDocs/javascript/javascript/logs';
import {metrics} from 'sentry/gettingStartedDocs/javascript/javascript/metrics';
import {profiling} from 'sentry/gettingStartedDocs/javascript/javascript/profiling';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
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
      'https://docs.sentry.io/platforms/javascript/guides/svelte/profiling/browser-profiling/',
  }),
  featureFlagOnboarding: featureFlag,
  logsOnboarding: logs({
    installSnippetBlock,
    docsPlatform: 'svelte',
    packageName: '@sentry/svelte',
  }),
  metricsOnboarding: metrics({
    installSnippetBlock,
    docsPlatform: 'svelte',
    packageName: '@sentry/svelte',
  }),
};

export default docs;
