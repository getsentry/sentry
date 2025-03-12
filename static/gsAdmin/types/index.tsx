import type * as Sentry from '@sentry/react';

import type ConfigStore from 'sentry/stores/configStore';
import type {Region} from 'sentry/types/system';

declare global {
  interface Window {
    /**
     * The sentry SDK
     */
    Sentry: typeof Sentry;
    /**
     * Global object used to boot the admin application
     */
    gsAdmin: {
      // TODO(lint): This will fail until we upgrade @typescript-eslint

      ConfigStore: typeof ConfigStore;
      renderApp: () => void;
    };
  }
}

export type PromoCode = {
  amount: string;
  campaign: string;
  code: string;
  dateCreated: string;
  dateExpires: string | null;
  duration: string;
  maxClaims: number;
  newOnly: boolean;
  numClaims: number;
  status: 'active' | 'inactive' | 'expired';
  trialDays: number;
  userEmail: string | null;
  userId: number;
};

type RelocationStatus = 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE' | 'PAUSE';

export enum RelocationSteps {
  UPLOADING = 1,
  PREPROCESSING = 2,
  VALIDATING = 3,
  IMPORTING = 4,
  POSTPROCESSING = 5,
  NOTIFYING = 6,
  COMPLETED = 7,
}

type RelocationStep = keyof typeof RelocationSteps;

type RelocationProvenance = 'SELF_HOSTED' | 'SAAS_TO_SAAS';

type RelocationAssociatedUser = {
  email: string;
  id: string;
  username: string;
};

export type Relocation = {
  creator: RelocationAssociatedUser | null;
  dateAdded: string;
  dateUpdated: string;
  failureReason: string;
  importedOrgIds: number[] | null;
  importedUserIds: number[] | null;
  latestNotified: 'STARTED' | 'FAILED' | 'SUCCEEDED' | null;
  latestUnclaimedEmailsSentAt: string | null;
  owner: RelocationAssociatedUser | null;
  provenance: RelocationProvenance;
  region: Region;
  scheduledCancelAtStep: RelocationStep | null;
  scheduledPauseAtStep: RelocationStep | null;
  status: RelocationStatus;
  step: RelocationStep;
  uuid: string;
  wantOrgSlugs: string[];
  wantUsernames: string[];
};
