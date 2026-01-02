import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';
import {platformOptions, type PlatformOptions} from './utils';

const docs: Docs<PlatformOptions> = {
  platformOptions,
  feedbackOnboardingCrashApi: crashReport,
  crashReportOnboarding: crashReport,
  onboarding,
};

export default docs;
