import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/javascript/featureFlag';
import {metrics} from 'sentry/gettingStartedDocs/javascript/javascript/metrics';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {logs} from './logs';
import {onboarding} from './onboarding';
import {profiling} from './profiling';
import {replay} from './replay';
import {installSnippetBlock} from './utils';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  featureFlagOnboarding: featureFlag,
  logsOnboarding: logs,
  metricsOnboarding: metrics({
    installSnippetBlock,
    docsPlatform: 'solid',
    packageName: '@sentry/solid',
  }),
};

export default docs;
