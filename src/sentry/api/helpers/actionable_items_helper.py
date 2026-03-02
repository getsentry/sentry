from sentry.models.eventerror import EventErrorType
from sentry.models.sourcemapprocessingissue import SourceMapProcessingIssue


class ActionPriority:
    HIGH = 1
    MEDIUM = 2
    LOW = 3
    UNKNOWN = 4


fileNameBlocklist = ["@webkit-masked-url"]

priority_ranking = {
    # Low Priority
    EventErrorType.CLOCK_DRIFT: ActionPriority.LOW,
    EventErrorType.FETCH_GENERIC_ERROR: ActionPriority.LOW,
    EventErrorType.FUTURE_TIMESTAMP: ActionPriority.LOW,
    EventErrorType.INVALID_ATTRIBUTE: ActionPriority.LOW,
    EventErrorType.INVALID_DATA: ActionPriority.LOW,
    EventErrorType.INVALID_ENVIRONMENT: ActionPriority.LOW,
    EventErrorType.NATIVE_BAD_DSYM: ActionPriority.LOW,
    EventErrorType.NATIVE_MISSING_DSYM: ActionPriority.LOW,
    EventErrorType.NATIVE_INTERNAL_FAILURE: ActionPriority.LOW,
    EventErrorType.NATIVE_SYMBOLICATOR_FAILED: ActionPriority.LOW,
    EventErrorType.NATIVE_UNSUPPORTED_DSYM: ActionPriority.LOW,
    EventErrorType.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM: ActionPriority.LOW,
    EventErrorType.PAST_TIMESTAMP: ActionPriority.LOW,
    EventErrorType.PROGUARD_MISSING_LINENO: ActionPriority.LOW,
    EventErrorType.PROGUARD_MISSING_MAPPING: ActionPriority.LOW,
    EventErrorType.RESTRICTED_IP: ActionPriority.LOW,
    EventErrorType.SECURITY_VIOLATION: ActionPriority.LOW,
    # Medium Priority
    EventErrorType.JS_MISSING_SOURCES_CONTENT: ActionPriority.MEDIUM,
    EventErrorType.JS_SCRAPING_DISABLED: ActionPriority.MEDIUM,
    # High Priority
    SourceMapProcessingIssue.DEBUG_ID_NO_SOURCEMAPS: ActionPriority.HIGH,
    SourceMapProcessingIssue.DIST_MISMATCH: ActionPriority.HIGH,
    SourceMapProcessingIssue.MISSING_RELEASE: ActionPriority.HIGH,
    SourceMapProcessingIssue.MISSING_SOURCEMAPS: ActionPriority.HIGH,
    SourceMapProcessingIssue.NO_URL_MATCH: ActionPriority.HIGH,
    SourceMapProcessingIssue.PARTIAL_MATCH: ActionPriority.HIGH,
    SourceMapProcessingIssue.SOURCEMAP_NOT_FOUND: ActionPriority.HIGH,
    SourceMapProcessingIssue.URL_NOT_VALID: ActionPriority.HIGH,
}

errors_to_hide = [
    EventErrorType.JS_INVALID_SOURCE_ENCODING,
    EventErrorType.JS_INVALID_SOURCEMAP_LOCATION,
    EventErrorType.JS_INVALID_SOURCEMAP,
    EventErrorType.JS_MISSING_SOURCE,
    EventErrorType.JS_SCRAPING_DISABLED,
    EventErrorType.JS_TOO_MANY_REMOTE_SOURCES,
    EventErrorType.MISSING_ATTRIBUTE,
    EventErrorType.NATIVE_MISSING_SYMBOL,
    EventErrorType.NATIVE_MISSING_SYSTEM_DSYM,
    EventErrorType.NATIVE_NO_CRASHED_THREAD,
    EventErrorType.NATIVE_SIMULATOR_FRAME,
    EventErrorType.NATIVE_UNKNOWN_IMAGE,
    EventErrorType.UNKNOWN_ERROR,
    EventErrorType.VALUE_TOO_LONG,
]

deprecated_event_errors = [
    EventErrorType.FETCH_INVALID_ENCODING,
    EventErrorType.FETCH_INVALID_HTTP_CODE,
    EventErrorType.FETCH_TIMEOUT,
    EventErrorType.FETCH_TOO_LARGE,
    EventErrorType.JS_INVALID_CONTENT,
    EventErrorType.JS_NO_COLUMN,
    EventErrorType.TOO_LARGE_FOR_CACHE,
]
