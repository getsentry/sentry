import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import type {Region} from 'sentry/types/system';

export type OrganizationSummaryWithRegion = OrganizationSummary & {
  region: Region;
};

export type OrganizationWithRegion = Organization & {
  region: Region;
};
