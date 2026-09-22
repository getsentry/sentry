import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {docs as nodeDocs} from 'sentry/gettingStartedDocs/node';
import {eveOnboarding} from 'sentry/gettingStartedDocs/node/agentMonitoring';

export const docs: Docs = {
  ...nodeDocs,
  onboarding: eveOnboarding,
};
