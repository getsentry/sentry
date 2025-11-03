import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {featureFlagOnboarding} from 'sentry/gettingStartedDocs/javascript/javascript/featureFlags';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {logs} from './logs';
import {onboarding} from './onboarding';
import {profiling} from './profiling';
import {replay} from './replay';
import {platformOptions, type PlatformOptions} from './utils';

const docs: Docs<PlatformOptions> = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  crashReportOnboarding: crashReport,
  platformOptions,
  profilingOnboarding: profiling,
  featureFlagOnboarding,
  logsOnboarding: logs,
};

export default docs;
