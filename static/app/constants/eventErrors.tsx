export enum JavascriptProcessingErrors {
  JS_GENERIC_FETCH_ERROR = 'js_generic_fetch_error',
  JS_INVALID_HTTP_CODE = 'js_invalid_http_code',
  JS_INVALID_CONTENT = 'js_invalid_content',
  JS_NO_COLUMN = 'js_no_column',
  JS_MISSING_SOURCE = 'js_no_source',
  JS_INVALID_SOURCEMAP = 'js_invalid_source',
  JS_TOO_MANY_REMOTE_SOURCES = 'js_too_many_sources',
  JS_INVALID_SOURCE_ENCODING = 'js_invalid_source_encoding',
  JS_INVALID_SOURCEMAP_LOCATION = 'js_invalid_sourcemap_location',
  JS_TOO_LARGE = 'js_too_large',
  JS_FETCH_TIMEOUT = 'js_fetch_timeout',
  JS_SCRAPING_DISABLED = 'js_scraping_disabled',
  JS_MISSING_SOURCES_CONTENT = 'js_missing_sources_content',
}

export enum HttpProcessingErrors {
  SECURITY_VIOLATION = 'security_violation',
  RESTRICTED_IP = 'restricted_ip',
  FETCH_GENERIC_ERROR = 'fetch_generic_error',
  FETCH_INVALID_HTTP_CODE = 'fetch_invalid_http_code',
  FETCH_INVALID_ENCODING = 'fetch_invalid_source_encoding',
  FETCH_TOO_LARGE = 'fetch_too_large',
  FETCH_TIMEOUT = 'fetch_timeout',
  TOO_LARGE_FOR_CACHE = 'too_large_for_cache',
}

export enum GenericSchemaErrors {
  UNKNOWN_ERROR = 'unknown_error',
  INVALID_DATA = 'invalid_data',
  INVALID_ATTRIBUTE = 'invalid_attribute',
  MISSING_ATTRIBUTE = 'missing_attribute',
  VALUE_TOO_LONG = 'value_too_long',
  FUTURE_TIMESTAMP = 'future_timestamp',
  PAST_TIMESTAMP = 'past_timestamp',
  CLOCK_DRIFT = 'clock_drift',
  INVALID_ENVIRONMENT = 'invalid_environment',
}

export enum NativeProcessingErrors {
  NATIVE_NO_CRASHED_THREAD = 'native_no_crashed_thread',
  NATIVE_INTERNAL_FAILURE = 'native_internal_failure',
  NATIVE_BAD_DSYM = 'native_bad_dsym',
  NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM = 'native_optionally_bundled_dsym',
  NATIVE_MISSING_DSYM = 'native_missing_dsym',
  NATIVE_MISSING_SYSTEM_DSYM = 'native_missing_system_dsym',
  NATIVE_MISSING_SYMBOL = 'native_missing_symbol',
  NATIVE_SIMULATOR_FRAME = 'native_simulator_frame',
  NATIVE_UNKNOWN_IMAGE = 'native_unknown_image',
  NATIVE_SYMBOLICATOR_FAILED = 'native_symbolicator_failed',
}

export enum ProguardProcessingErrors {
  PROGUARD_MISSING_MAPPING = 'proguard_missing_mapping',
  PROGUARD_MISSING_LINENO = 'proguard_missing_lineno',
}

export enum CocoaProcessingErrors {
  COCOA_INVALID_DATA = 'invalid_data',
}
