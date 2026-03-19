import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  feedbackOnboardingJsLoader,
  replayOnboardingJsLoader,
} from 'sentry/gettingStartedDocs/javascript/jsLoader';

import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  replayOnboardingJsLoader,
  feedbackOnboardingJsLoader,
};
