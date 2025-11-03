import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {crashReport} from 'sentry/gettingStartedDocs/cordova/cordova/crashReport';
import {onboarding} from 'sentry/gettingStartedDocs/cordova/cordova/onboarding';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReport,
};

export default docs;
