import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {logs} from 'sentry/gettingStartedDocs/godot/logs';
import {onboarding} from 'sentry/gettingStartedDocs/godot/onboarding';

const docs: Docs = {
  onboarding,
  logsOnboarding: logs,
};

export default docs;
