export type StackTraceEventParameters = {
  'stack-trace.display_option_absolute_addresses_clicked': {
    checked: boolean;
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.display_option_absolute_file_paths_clicked': {
    checked: boolean;
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.display_option_minified_clicked': {
    checked: boolean;
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.display_option_raw_stack_trace_clicked': {
    checked: boolean;
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.display_option_unsymbolicated_clicked': {
    checked: boolean;
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.display_option_verbose_function_names_clicked': {
    checked: boolean;
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.download_clicked': {
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.full_stack_trace_clicked': {
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.most_relevant_clicked': {
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.sort_option_recent_first_clicked': {
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
  'stack-trace.sort_option_recent_last_clicked': {
    is_mobile: boolean;
    project_slug: string;
    platform?: string;
  };
};

export const stackTraceEventMap: Record<keyof StackTraceEventParameters, string> = {
  'stack-trace.display_option_absolute_addresses_clicked':
    'Stack Trace: Display Option - Absolute Addresses - Clicked',
  'stack-trace.display_option_absolute_file_paths_clicked':
    'Stack Trace: Display Option - Absolute File Paths - Clicked',
  'stack-trace.display_option_minified_clicked':
    'Stack Trace: Display Option - Minified - Clicked',
  'stack-trace.display_option_raw_stack_trace_clicked':
    'Stack Trace: Display Option - Raw Stack Trace - Clicked',
  'stack-trace.display_option_unsymbolicated_clicked':
    'Stack Trace: Display Option - Unsymbolicated - Clicked',
  'stack-trace.display_option_verbose_function_names_clicked':
    'Stack Trace: Display Option - Verbose Function Names - Clicked',
  'stack-trace.download_clicked': 'Stack Trace: Download - Clicked',
  'stack-trace.full_stack_trace_clicked': 'Stack Trace: Full Stack Trace - Clicked',
  'stack-trace.most_relevant_clicked': 'Stack Trace: Most Relevant - Clicked',
  'stack-trace.sort_option_recent_first_clicked':
    'Stack Trace: Sort Option - Recent First - Clicked',
  'stack-trace.sort_option_recent_last_clicked':
    'Stack Trace: Sort Option - Recent Last - Clicked',
};
