import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {onboarding} from 'sentry/gettingStartedDocs/pi/onboarding';
import {agentMonitoring} from 'sentry/gettingStartedDocs/node/agentMonitoring';

// Pi sends its sessions without the Sentry SDK, so the Node SDK product docs
// (logs, metrics, profiling, ...) don't apply.
export const docs: Docs = {
  onboarding,
  agentMonitoringOnboarding: agentMonitoring(),
};
