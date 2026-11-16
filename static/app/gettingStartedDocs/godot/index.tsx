import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {logs} from './logs';
import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  logsOnboarding: logs,
};
