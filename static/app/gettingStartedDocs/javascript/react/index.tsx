import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlag} from 'sentry/gettingStartedDocs/javascript/javascript/featureFlag';
import {logs} from 'sentry/gettingStartedDocs/javascript/react/logs';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {onboarding} from './onboarding';
import {performance} from './performance';
import {profiling} from './profiling';
import {replay} from './replay';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  performanceOnboarding: performance,
  crashReportOnboarding: crashReport,
  profilingOnboarding: profiling,
  logsOnboarding: logs,
  featureFlagOnboarding: featureFlag,
};

export default docs;
