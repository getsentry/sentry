type JsonObject = Record<string, unknown>;
type JsonArray = unknown[];

export type NetworkBody = JsonObject | JsonArray | string;

export type NetworkMetaWarning =
  | 'JSON_TRUNCATED'
  | 'TEXT_TRUNCATED'
  | 'INVALID_JSON'
  | 'URL_SKIPPED';

interface NetworkMeta {
  warnings?: NetworkMetaWarning[];
}

export interface ReplayNetworkRequestOrResponse {
  headers: Record<string, string>;
  _meta?: NetworkMeta;
  body?: NetworkBody;
  size?: number;
}
