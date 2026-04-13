import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {crashReport} from 'sentry/gettingStartedDocs/cordova/crashReport';
import {onboarding} from 'sentry/gettingStartedDocs/cordova/onboarding';

export const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReport,
};
