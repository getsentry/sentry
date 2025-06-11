type JsonObject = Record<string, unknown>;
type JsonArray = unknown[];

export type NetworkMetaWarning =
  | 'MAYBE_JSON_TRUNCATED'
  | 'JSON_TRUNCATED'
  | 'TEXT_TRUNCATED'
  | 'INVALID_JSON'
  | 'URL_SKIPPED'
  | 'BODY_PARSE_ERROR'
  | 'BODY_PARSE_TIMEOUT'
  | 'UNPARSEABLE_BODY_TYPE';

interface NetworkMeta {
  warnings?: NetworkMetaWarning[];
}

type NetworkBody = JsonObject | JsonArray | string;

export interface ReplayNetworkRequestOrResponse {
  headers: Record<string, string>;
  _meta?: NetworkMeta;
  body?: NetworkBody;
  size?: number;
}
