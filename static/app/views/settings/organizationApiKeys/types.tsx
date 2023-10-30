import {API_ACCESS_SCOPES} from 'sentry/constants';

type Scope = (typeof API_ACCESS_SCOPES)[number];

export type DeprecatedApiKey = {
  allowed_origins: string;
  id: string;
  key: string;
  label: string;
  scope_list: Scope[];
  status: number;
};
