import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {docs as nodeDocs} from 'sentry/gettingStartedDocs/node';
import {onboarding} from 'sentry/gettingStartedDocs/node-flue/onboarding';

export const docs: Docs = {
  ...nodeDocs,
  onboarding,
};
