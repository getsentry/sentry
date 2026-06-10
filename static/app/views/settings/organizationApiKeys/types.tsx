// eslint-disable-next-line @sentry/scraps/restrict-types-file -- type-only import from a runtime module; extracting a type leaf would cascade to its many importers
import type {API_ACCESS_SCOPES} from 'sentry/constants';

type Scope = (typeof API_ACCESS_SCOPES)[number];

export type DeprecatedApiKey = {
  allowed_origins: string;
  id: string;
  key: string;
  label: string;
  scope_list: Scope[];
  status: number;
};
