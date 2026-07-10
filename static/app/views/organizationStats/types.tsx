import type {Location} from 'history';

import type {PageFilters} from 'sentry/types/core';
import type {Organization, SeriesApi} from 'sentry/types/organization';
import type {ReactRouter3Navigate} from 'sentry/utils/useNavigate';

export type OrganizationStatsProps = {
  location: Location;
  navigate: ReactRouter3Navigate;
  organization: Organization;
  selection: PageFilters;
};

/**
 * Raw response from API endpoint
 */
export interface UsageSeries extends SeriesApi {
  // index signature is present because we often send this
  // data to sentry as part of the event context.
  end: string;
  start: string;
}

export type UsageStat = {
  accepted: number;
  accepted_stored: number;
  clientDiscard: number;
  date: string;
  filtered: number;
  invalid: number;
  rateLimited: number;
  total: number;
};
