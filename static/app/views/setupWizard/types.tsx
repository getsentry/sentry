import type {OrganizationSummary} from 'sentry/types/organizationBase';
import type {Region} from 'sentry/types/system';

export type OrganizationSummaryWithRegion = OrganizationSummary & {
  region: Region;
};
