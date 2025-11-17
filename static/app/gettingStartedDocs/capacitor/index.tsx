import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {crashReport} from './crashReport';
import {onboarding} from './onboarding';
import {sessionReplay} from './sessionReplay';
import {userFeedback} from './userFeedback';
import {platformOptions, type PlatformOptions} from './utils';

const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  feedbackOnboardingNpm: userFeedback,
  replayOnboarding: sessionReplay,
  crashReportOnboarding: crashReport,
};

export default docs;
