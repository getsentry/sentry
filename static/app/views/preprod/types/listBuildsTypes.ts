import type {BuildDetailsApiResponse} from './buildDetailsTypes';

interface PaginationInfo {
  has_next: boolean;
  has_prev: boolean;
  page: number;
  per_page: number;
  total_count: number | string;
  next?: number | null;
  prev?: number | null;
}

export interface ListBuildsApiResponse {
  builds: BuildDetailsApiResponse[];
  pagination: PaginationInfo;
}
