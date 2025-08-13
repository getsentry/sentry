import type {BuildDetailsApiResponse} from './buildDetailsTypes';

export interface PaginationInfo {
  has_next: boolean;
  has_prev: boolean;
  next: number | null;
  page: number;
  per_page: number;
  prev: number | null;
  total_count: number | string;
}

export interface ListBuildsApiResponse {
  builds: BuildDetailsApiResponse[];
  pagination: PaginationInfo;
}
