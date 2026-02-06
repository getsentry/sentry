import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {crashReport} from './crashReport';
import {logs} from './logs';
import {metrics} from './metrics';
import {onboarding} from './onboarding';
import {profiling} from './profiling';
import {sessionReplay} from './sessionReplay';
import {userFeedback} from './userFeedback';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: userFeedback,
  crashReportOnboarding: crashReport,
  replayOnboarding: sessionReplay,
  profilingOnboarding: profiling,
  metricsOnboarding: metrics,
  logsOnboarding: logs,
};

export default docs;
