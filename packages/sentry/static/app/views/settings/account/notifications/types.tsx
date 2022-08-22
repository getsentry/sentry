import {ObjectStatus} from 'sentry/types/core';

type IdentityProvider = {
  externalId: string;
  id: string;
  type: string;
};

export type Identity = {
  externalId: string;
  id: string;
  identityProvider: IdentityProvider;
  status: ObjectStatus;
};
