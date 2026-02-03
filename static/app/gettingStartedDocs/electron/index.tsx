import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {crashReport} from './crashReport';
import {feedback} from './feedback';
import {onboarding} from './onboarding';
import {replay} from './replay';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: feedback,
  replayOnboarding: replay,
  crashReportOnboarding: crashReport,
};

export default docs;
