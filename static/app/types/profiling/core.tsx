type Annotation = {
  key: string;
  values: string[];
};

export type Trace = {
  app_id: string;
  app_version: string;
  device_class: string;
  device_locale: string;
  device_manufacturer: string;
  device_model: string;
  failed: boolean;
  id: string;
  interaction_name: string;
  start_time_unix: number;
  trace_duration_ms: number;
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
