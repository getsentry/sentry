import {z} from 'zod';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';

type ProjectPerformanceSettingValue = boolean | number | string;
export type ProjectPerformanceSettings = Record<string, ProjectPerformanceSettingValue>;

export enum DetectorConfigAdmin {
  N_PLUS_DB_ENABLED = 'n_plus_one_db_queries_detection_enabled',
  SLOW_DB_ENABLED = 'slow_db_queries_detection_enabled',
  DB_MAIN_THREAD_ENABLED = 'db_on_main_thread_detection_enabled',
  FILE_IO_ENABLED = 'file_io_on_main_thread_detection_enabled',
  CONSECUTIVE_DB_ENABLED = 'consecutive_db_queries_detection_enabled',
  RENDER_BLOCK_ASSET_ENABLED = 'large_render_blocking_asset_detection_enabled',
  UNCOMPRESSED_ASSET_ENABLED = 'uncompressed_assets_detection_enabled',
  LARGE_HTTP_PAYLOAD_ENABLED = 'large_http_payload_detection_enabled',
  N_PLUS_ONE_API_CALLS_ENABLED = 'n_plus_one_api_calls_detection_enabled',
  CONSECUTIVE_HTTP_ENABLED = 'consecutive_http_spans_detection_enabled',
  HTTP_OVERHEAD_ENABLED = 'http_overhead_detection_enabled',
  TRANSACTION_DURATION_REGRESSION_ENABLED = 'transaction_duration_regression_detection_enabled',
  FUNCTION_DURATION_REGRESSION_ENABLED = 'function_duration_regression_detection_enabled',
  DB_QUERY_INJECTION_ENABLED = 'db_query_injection_detection_enabled',
  WEB_VITALS_ENABLED = 'web_vitals_detection_enabled',
  AI_ISSUE_DETECTION_ENABLED = 'ai_issue_detection_enabled',
  AI_DETECTED_HTTP_ENABLED = 'ai_detected_http_enabled',
  AI_DETECTED_DB_ENABLED = 'ai_detected_db_enabled',
  AI_DETECTED_RUNTIME_PERFORMANCE_ENABLED = 'ai_detected_runtime_performance_enabled',
  AI_DETECTED_SECURITY_ENABLED = 'ai_detected_security_enabled',
  AI_DETECTED_CODE_HEALTH_ENABLED = 'ai_detected_code_health_enabled',
  AI_DETECTED_GENERAL_ENABLED = 'ai_detected_general_enabled',
}

export enum DetectorConfigCustomer {
  SLOW_DB_DURATION = 'slow_db_query_duration_threshold',
  N_PLUS_DB_DURATION = 'n_plus_one_db_duration_threshold',
  N_PLUS_DB_COUNT = 'n_plus_one_db_count',
  N_PLUS_API_CALLS_DURATION = 'n_plus_one_api_calls_total_duration_threshold',
  RENDER_BLOCKING_ASSET_RATIO = 'render_blocking_fcp_ratio',
  LARGE_HTTP_PAYLOAD_SIZE = 'large_http_payload_size_threshold',
  LARGE_HTTP_PAYLOAD_FILTERED_PATHS = 'large_http_payload_filtered_paths',
  DB_ON_MAIN_THREAD_DURATION = 'db_on_main_thread_duration_threshold',
  FILE_IO_MAIN_THREAD_DURATION = 'file_io_on_main_thread_duration_threshold',
  UNCOMPRESSED_ASSET_DURATION = 'uncompressed_asset_duration_threshold',
  UNCOMPRESSED_ASSET_SIZE = 'uncompressed_asset_size_threshold',
  CONSECUTIVE_DB_MIN_TIME_SAVED = 'consecutive_db_min_time_saved_threshold',
  CONSECUTIVE_HTTP_MIN_TIME_SAVED = 'consecutive_http_spans_min_time_saved_threshold',
  HTTP_OVERHEAD_REQUEST_DELAY = 'http_request_delay_threshold',
  SQL_INJECTION_QUERY_VALUE_LENGTH = 'sql_injection_query_value_length_threshold',
  WEB_VITALS_COUNT = 'web_vitals_count',
}

export const regressionAdminSchema = z.object({
  transaction_duration_regression_detection_enabled: z.boolean(),
  function_duration_regression_detection_enabled: z.boolean(),
});

export function handleSuperUserError(error: Error): void {
  if (error instanceof RequestError && error.status === 403) {
    addErrorMessage(
      t(
        'This action requires active super user access. Please re-authenticate to make changes.'
      )
    );
  }
}
