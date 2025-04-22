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
  span_annotations?: readonly Annotation[];
  spans?: readonly Span[];
  trace_annotations?: readonly Annotation[];
};

type Span = {
  duration_ms: number;
  id: string | number;
  name: string;
  relative_start_ms: number;
  thread_name: string;
  annotations?: readonly Annotation[];
  children?: readonly Span[];
  network_request?: Readonly<{
    method: string;
    status_code: number;
    success: boolean;
  }>;
  queue_label?: string;
};
