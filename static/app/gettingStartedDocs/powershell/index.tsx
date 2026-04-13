import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  feedbackOnboardingCrashApi: crashReport,
};
