import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {feedbackOnboardingCrashApiDart} from 'sentry/gettingStartedDocs/dart/dart';
import {logs} from 'sentry/gettingStartedDocs/flutter/flutter/logs';
import {onboarding} from 'sentry/gettingStartedDocs/flutter/flutter/onboarding';
import {sessionReplay} from 'sentry/gettingStartedDocs/flutter/flutter/sessionReplay';
import {userFeedback} from 'sentry/gettingStartedDocs/flutter/flutter/userFeedback';

const docs: Docs = {
  onboarding,
  feedbackOnboardingNpm: userFeedback,
  crashReportOnboarding: feedbackOnboardingCrashApiDart,
  replayOnboarding: sessionReplay,
  logsOnboarding: logs,
};

export default docs;
