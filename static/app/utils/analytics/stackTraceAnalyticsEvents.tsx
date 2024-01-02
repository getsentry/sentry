export interface SourceMapWizardBlueThunderAnalyticsParams {
  event_id: string;
  project_id: string;
  event_platform?: string;
  event_runtime?: string;
  sdk_name?: string;
  sdk_version?: string;
}

export type StackTraceEventParameters = {
  'source_map_debug_blue_thunder.modal_closed': SourceMapWizardBlueThunderAnalyticsParams;
  'source_map_debug_blue_thunder.modal_opened': SourceMapWizardBlueThunderAnalyticsParams;
  'source_map_debug_blue_thunder.source_map_wizard_command_copied': SourceMapWizardBlueThunderAnalyticsParams;
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
  'stack_trace.prism_missing_language': {
    attempted_language: string;
  };
  'stack_trace.threads.thread_selected': {
    has_stacktrace: boolean;
    num_in_app_frames: number;
    num_threads: number;
    thread_index: number;
    thread_state: string;
    is_crashed_thread?: boolean;
    is_current_thread?: boolean;
    platform?: string;
  };
  'stack_trace.threads.thread_selector_opened': {
    num_threads: number;
    platform?: string;
  };
};

export const stackTraceEventMap: Record<keyof StackTraceEventParameters, string> = {
  'source_map_debug_blue_thunder.modal_closed': 'Source Map Debugger Modal Closed',
  'source_map_debug_blue_thunder.modal_opened': 'Source Map Debugger Modal Opened',
  'source_map_debug_blue_thunder.source_map_wizard_command_copied':
    'Source Map Wizard Command Copied in Source Map Debugger Modal',
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
  'stack_trace.threads.thread_selected': 'Stack Trace: Thread Selected',
  'stack_trace.threads.thread_selector_opened': 'Stack Trace: Thread Selector Opened',
  'stack_trace.prism_missing_language': 'Stack Trace: Prism.js Language Not Found',
};
