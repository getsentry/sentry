import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  crashReportOnboarding: CrashReportWebApiOnboarding,
};
