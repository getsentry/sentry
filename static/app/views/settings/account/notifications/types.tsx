import {ObjectStatus} from 'sentry/types/core';

type IdentityProvider = {
  id: string;
  type: string;
  externalId: string;
};

export type Identity = {
  id: string;
  identityProvider: IdentityProvider;
  externalId: string;
  status: ObjectStatus;
};
