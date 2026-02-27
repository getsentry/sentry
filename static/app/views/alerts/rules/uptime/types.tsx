import type {Actor, ObjectStatus} from 'sentry/types/core';

export enum UptimeMonitorStatus {
  OK = 1,
  FAILED = 2,
}

export enum UptimeMonitorMode {
  MANUAL = 1,
  AUTO_DETECTED_ONBOARDING = 2,
  AUTO_DETECTED_ACTIVE = 3,
}

export interface UptimeRule {
  assertion: UptimeAssertion | null;
  body: string | null;
  downtimeThreshold: number;
  environment: string | null;
  headers: Array<[key: string, value: string]>;
  id: string;
  intervalSeconds: number;
  method: string;
  mode: UptimeMonitorMode;
  name: string;
  owner: Actor;
  projectSlug: string;
  recoveryThreshold: number;
  status: ObjectStatus;
  timeoutMs: number;
  traceSampling: boolean;
  uptimeStatus: UptimeMonitorStatus;
  url: string;
}

export interface UptimeCheck {
  assertionFailureData: UptimeAssertion | null;
  checkStatus: CheckStatus;
  checkStatusReason: CheckStatusReason | null;
  durationMs: number;
  environment: string;
  httpStatusCode: number | null;
  projectUptimeSubscriptionId: number;
  region: string;
  regionName: string;
  scheduledCheckTime: string;
  timestamp: string;
  traceId: string;
  traceItemId: string;
  uptimeCheckId: string;
}

export interface UptimeSummary {
  avgDurationUs: number;
  downtimeChecks: number;
  failedChecks: number;
  missedWindowChecks: number;
  totalChecks: number;
}

export enum CheckStatusReason {
  FAILURE = 'failure',
  TIMEOUT = 'timeout',
  DNS_ERROR = 'dns_error',
  TLS_ERROR = 'tls_error',
  CONNECTION_ERROR = 'connection_error',
  REDIRECT_ERROR = 'redirect_error',
  MISS_PRODUCED = 'miss_produced',
  MISS_BACKFILL = 'miss_backfill',
  ASSERTION_COMPILATION_ERROR = 'assertion_compilation_error',
  ASSERTION_EVALUATION_ERROR = 'assertion_evaluation_error',
}

export enum CheckStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  FAILURE_INCIDENT = 'failure_incident',
  MISSED_WINDOW = 'missed_window',
}

type StatsBucket = {
  [CheckStatus.SUCCESS]: number;
  [CheckStatus.FAILURE]: number;
  [CheckStatus.FAILURE_INCIDENT]: number;
  [CheckStatus.MISSED_WINDOW]: number;
};

export type CheckStatusBucket = [timestamp: number, stats: StatsBucket];

// Uptime Assertion Types (matching Rust types from uptime-checker)

export interface UptimeAssertion {
  // XXX(epurkhiser): The uptime-checker would actually allow this to be any
  // Op, but we're restricting it on the frontend to always be a UptimeAndOp.
  root: UptimeAndOp;
}

export enum UptimeOpType {
  AND = 'and',
  OR = 'or',
  NOT = 'not',
  STATUS_CODE_CHECK = 'status_code_check',
  JSON_PATH = 'json_path',
  HEADER_CHECK = 'header_check',
}

export enum UptimeComparisonType {
  EQUALS = 'equals',
  NOT_EQUAL = 'not_equal',
  LESS_THAN = 'less_than',
  GREATER_THAN = 'greater_than',
  ALWAYS = 'always',
  NEVER = 'never',
}

export type UptimeComparison = {cmp: UptimeComparisonType};

export type UptimeHeaderOperand =
  | {header_op: 'none'}
  | {header_op: 'literal'; value: string}
  | {header_op: 'glob'; pattern: {value: string}};

export type UptimeJsonPathOperand =
  | {jsonpath_op: 'none'}
  | {jsonpath_op: 'literal'; value: string}
  | {jsonpath_op: 'glob'; pattern: {value: string}};

export interface UptimeAndOp {
  children: UptimeOp[];
  id: string;
  op: UptimeOpType.AND;
}

export interface UptimeOrOp {
  children: UptimeOp[];
  id: string;
  op: UptimeOpType.OR;
}

export interface UptimeNotOp {
  id: string;
  op: UptimeOpType.NOT;
  operand: UptimeOp;
}

export interface UptimeStatusCodeOp {
  id: string;
  op: UptimeOpType.STATUS_CODE_CHECK;
  operator: UptimeComparison;
  value: number;
}

export interface UptimeJsonPathOp {
  id: string;
  op: UptimeOpType.JSON_PATH;
  operand: UptimeJsonPathOperand;
  operator: UptimeComparison;
  value: string;
}

export interface UptimeHeaderCheckOp {
  id: string;
  key_op: UptimeComparison;
  key_operand: UptimeHeaderOperand;
  op: UptimeOpType.HEADER_CHECK;
  value_op: UptimeComparison;
  value_operand: UptimeHeaderOperand;
}

export type UptimeGroupOp = UptimeAndOp | UptimeOrOp;
export type UptimeLogicalOp = UptimeGroupOp | UptimeNotOp;

export type UptimeOp =
  | UptimeLogicalOp
  | UptimeStatusCodeOp
  | UptimeJsonPathOp
  | UptimeHeaderCheckOp;

// Preview Check Types (raw response from uptime-checker /execute_config endpoint)

export enum PreviewCheckStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  MISSED_WINDOW = 'missed_window',
  DISALLOWED_BY_ROBOTS = 'disallowed_by_robots',
}

enum PreviewCheckStatusReasonType {
  TIMEOUT = 'timeout',
  DNS_ERROR = 'dns_error',
  TLS_ERROR = 'tls_error',
  CONNECTION_ERROR = 'connection_error',
  REDIRECT_ERROR = 'redirect_error',
  FAILURE = 'failure',
  MISS_PRODUCED = 'miss_produced',
  MISS_BACKFILL = 'miss_backfill',
  ASSERTION_COMPILATION_ERROR = 'assertion_compilation_error',
  ASSERTION_EVALUATION_ERROR = 'assertion_evaluation_error',
}

interface PreviewCheckStatusReason {
  description: string;
  type: PreviewCheckStatusReasonType;
}

export interface PreviewCheckResponse {
  check_result?: {
    actual_check_time_ms: number;
    duration_ms: number | null;
    guid: string;
    region: string;
    scheduled_check_time_ms: number;
    span_id: string;
    status: PreviewCheckStatus;
    status_reason: PreviewCheckStatusReason | null;
    subscription_id: string;
    trace_id: string;
    request_info?: {
      http_status_code: number | null;
      request_type: string;
      url: string;
      /** Base64-encoded response body, captured when always_capture_response is enabled */
      response_body?: string | null;
      /** Response headers as [key, value] tuples, captured when always_capture_response is enabled */
      response_headers?: Array<[string, string]> | null;
    } | null;
  };
}

export interface PreviewCheckPayload {
  timeoutMs: number;
  url: string;
  assertion?: UptimeAssertion | null;
  body?: string | null;
  headers?: Array<[string, string]>;
  method?: string;
}

// Assertion Suggestions Types (from Seer-powered endpoint)

export enum UptimeAssertionType {
  STATUS_CODE = 'status_code',
  JSON_PATH = 'json_path',
  HEADER = 'header',
}

export interface UptimeAssertionSuggestion {
  assertion_json: UptimeOp;
  assertion_type: UptimeAssertionType;
  comparison: Exclude<UptimeComparisonType, UptimeComparisonType.NEVER>;
  confidence: number;
  expected_value: string;
  explanation: string;
  header_name: string | null;
  json_path: string | null;
}

export interface UptimeAssertionSuggestionsResponse {
  preview_result: PreviewCheckResponse;
  suggested_assertion: UptimeAssertion | null;
  suggestions: UptimeAssertionSuggestion[] | null;
}
