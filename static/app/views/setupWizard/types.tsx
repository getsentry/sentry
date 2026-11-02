import type {OrganizationSummary} from 'sentry/types/organization';
import type {Locality} from 'sentry/types/system';

export type OrganizationSummaryWithLocality = OrganizationSummary & {
  region: Locality;
};

export type WizardSession =
  | {redirectUrl: string; status: 'unauthenticated'}
  | {status: 'pending' | 'selected' | 'completed' | 'expired'};
