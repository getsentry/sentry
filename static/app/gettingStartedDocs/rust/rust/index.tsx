import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {crashReport} from './crashReport';
import {logs} from './logs';
import {onboarding} from './onboarding';

const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReport,
  logsOnboarding: logs,
};

export default docs;
