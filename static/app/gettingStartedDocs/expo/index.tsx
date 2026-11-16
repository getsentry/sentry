import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
// Expo apps use the React Native SDK, so the product-specific onboarding
// (logs, metrics, replay, feedback, etc.) is shared with React Native.
import {crashReport} from 'sentry/gettingStartedDocs/react-native/crashReport';
import {logs} from 'sentry/gettingStartedDocs/react-native/logs';
import {metrics} from 'sentry/gettingStartedDocs/react-native/metrics';
import {profiling} from 'sentry/gettingStartedDocs/react-native/profiling';
import {sessionReplay} from 'sentry/gettingStartedDocs/react-native/sessionReplay';
import {userFeedback} from 'sentry/gettingStartedDocs/react-native/userFeedback';

import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: userFeedback,
  crashReportOnboarding: crashReport,
  replayOnboarding: sessionReplay,
  profilingOnboarding: profiling,
  metricsOnboarding: metrics,
  logsOnboarding: logs,
};
