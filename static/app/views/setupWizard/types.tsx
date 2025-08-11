import type {Organization} from 'sentry/types/organization';
import type {Region} from 'sentry/types/system';

export type OrganizationWithRegion = Organization & {
  region: Region;
};
