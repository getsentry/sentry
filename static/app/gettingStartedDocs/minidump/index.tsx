import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {CrashReportWebApiOnboarding} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {onboarding} from 'sentry/gettingStartedDocs/minidump/onboarding';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: CrashReportWebApiOnboarding,
};

export default docs;
