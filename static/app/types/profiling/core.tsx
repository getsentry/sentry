type Annotation = {
  key: string;
  values: string[];
};

export type Trace = {
  device_classification: string;
  device_locale: string;
  device_manufacturer: string;
  device_model: string;
  device_os_version: string;
  failed: boolean;
  id: string;
  project_id: string;
  timestamp: number;
  trace_duration_ms: number;
  transaction_name: string;
  version_code: string;
  version_name: string;
  backtrace_available?: boolean;
  error_code?: number;
  error_code_name?: string;
  error_description?: string;
  span_annotations?: Readonly<Annotation[]>;
  spans?: Readonly<Span[]>;
  trace_annotations?: Readonly<Annotation[]>;
};

export type Span = {
  duration_ms: number;
  id: string | number;
  name: string;
  relative_start_ms: number;
  thread_name: string;
  annotations?: Readonly<Annotation[]>;
  children?: Readonly<Span[]>;
  network_request?: Readonly<{
    method: string;
    status_code: number;
    success: boolean;
  }>;
  queue_label?: string;
};

type Percentiles = {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
};

export type FunctionCall = {
  duration_ns: Percentiles;
  frequency: Percentiles;
  image: string;
  key: string;
  line: number;
  main_thread_percent: number;
  path: string;
  profile_id_to_thread_id: Record<string, number>;
  profile_ids: string[];
  symbol: string;
  transaction_names: string[];
};

export type VersionedFunctionCalls = {
  Versions: Record<string, {FunctionCalls: FunctionCall[]}>;
};

export type ProfileTransaction = {
  duration_ms: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  last_profile_at: string;
  name: string;
  profiles_count: number;
  project_id: string;
  versions: string[];
};
