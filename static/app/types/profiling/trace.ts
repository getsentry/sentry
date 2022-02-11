type Annotation = {
  key: string;
  values: string[];
};

export type Trace = {
  app_version: string;
  device_class: string;
  device_locale: string;
  device_manufacturer: string;
  device_model: string;
  id: string;
  interaction_name: string;
  start_time_unix: number;
  trace_duration_ms: number;
  backtrace_available?: boolean;
  error_code?: number;
  error_code_name?: string;
  error_description?: string;
  failed?: boolean;
  span_annotations?: Annotation[];
  spans?: Span[];
  trace_annotations?: Annotation[];
};

export type Span = {
  duration_ms: number;
  id: string | number;
  name: string;
  relative_start_ms: number;
  thread_name: string;
  annotations?: Annotation[];
  children?: Span[];
  network_request?: {
    method: string;
    status_code: number;
    success: boolean;
  };
  queue_label?: string;
};
