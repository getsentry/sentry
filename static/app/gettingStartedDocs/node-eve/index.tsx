import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {docs as nodeDocs} from 'sentry/gettingStartedDocs/node';
import {onboarding} from 'sentry/gettingStartedDocs/node-eve/onboarding';

export const docs: Docs = {
  ...nodeDocs,
  onboarding,
};
