import {ObjectStatus} from 'sentry/types/core';

interface IdentityProvider {
  id: string;
  type: string;
  externalId: string;
}

export interface Identity {
  id: string;
  identityProvider: IdentityProvider;
  externalId: string;
  status: ObjectStatus;
}
