from sentry.models.eventerror import EventError
from sentry.models.sourcemapprocessingissue import SourceMapProcessingIssue


class ActionPriority:
    HIGH = 1
    MEDIUM = 2
    LOW = 3
    UNKNOWN = 4


sourcemap_sdks = [
    "sentry.javascript.astro",
    "sentry.javascript.browser",
    "sentry.javascript.node",
    "sentry.javascript.react",
    "sentry.javascript.angular",
    "sentry.javascript.angular-ivy",
    "sentry.javascript.ember",
    "sentry.javascript.gatsby",
    "sentry.javascript.vue",
    "sentry.javascript.nextjs",
    "sentry.javascript.remix",
    "sentry.javascript.svelte",
    "sentry.javascript.sveltekit",
    "sentry.javascript.react-native",
]

fileNameBlocklist = ["@webkit-masked-url"]

priority_ranking = {
    # Low Priority
    EventError.CLOCK_DRIFT: ActionPriority.LOW,
    EventError.FETCH_GENERIC_ERROR: ActionPriority.LOW,
    EventError.FUTURE_TIMESTAMP: ActionPriority.LOW,
    EventError.INVALID_ATTRIBUTE: ActionPriority.LOW,
    EventError.INVALID_DATA: ActionPriority.LOW,
    EventError.INVALID_ENVIRONMENT: ActionPriority.LOW,
    EventError.NATIVE_BAD_DSYM: ActionPriority.LOW,
    EventError.NATIVE_MISSING_DSYM: ActionPriority.LOW,
    EventError.NATIVE_INTERNAL_FAILURE: ActionPriority.LOW,
    EventError.NATIVE_SYMBOLICATOR_FAILED: ActionPriority.LOW,
    EventError.NATIVE_UNSUPPORTED_DSYM: ActionPriority.LOW,
    EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM: ActionPriority.LOW,
    EventError.PAST_TIMESTAMP: ActionPriority.LOW,
    EventError.PROGUARD_MISSING_LINENO: ActionPriority.LOW,
    EventError.PROGUARD_MISSING_MAPPING: ActionPriority.LOW,
    EventError.RESTRICTED_IP: ActionPriority.LOW,
    EventError.SECURITY_VIOLATION: ActionPriority.LOW,
    # Medium Priority
    EventError.JS_MISSING_SOURCES_CONTENT: ActionPriority.MEDIUM,
    EventError.JS_SCRAPING_DISABLED: ActionPriority.MEDIUM,
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
    EventError.JS_INVALID_SOURCE_ENCODING,
    EventError.JS_INVALID_SOURCEMAP_LOCATION,
    EventError.JS_INVALID_SOURCEMAP,
    EventError.JS_MISSING_SOURCE,
    EventError.JS_SCRAPING_DISABLED,
    EventError.JS_TOO_MANY_REMOTE_SOURCES,
    EventError.MISSING_ATTRIBUTE,
    EventError.NATIVE_MISSING_SYMBOL,
    EventError.NATIVE_MISSING_SYSTEM_DSYM,
    EventError.NATIVE_NO_CRASHED_THREAD,
    EventError.NATIVE_SIMULATOR_FRAME,
    EventError.NATIVE_UNKNOWN_IMAGE,
    EventError.UNKNOWN_ERROR,
    EventError.VALUE_TOO_LONG,
]

deprecated_event_errors = [
    EventError.FETCH_INVALID_ENCODING,
    EventError.FETCH_INVALID_HTTP_CODE,
    EventError.FETCH_TIMEOUT,
    EventError.FETCH_TOO_LARGE,
    EventError.JS_INVALID_CONTENT,
    EventError.JS_NO_COLUMN,
    EventError.TOO_LARGE_FOR_CACHE,
]


# These checks mirror what we do in the front end in getUniqueFilesFromException
def find_debug_frames(event):
    debug_frames = []
    exceptions = event.interfaces["exception"].values
    seen_filenames = []

    for exception_idx, exception in enumerate(exceptions):
        for frame_idx, frame in enumerate(exception.stacktrace.frames):
            if (
                frame.in_app
                and is_frame_filename_valid(frame)
                and frame.lineno
                and frame.filename not in seen_filenames
            ):
                debug_frames.append((frame_idx, exception_idx))
                seen_filenames.append(frame.filename)

    return debug_frames


def get_file_extension(filename):
    segments = filename.split(".")
    if len(segments) > 1:
        return segments[-1]
    return None


def is_frame_filename_valid(frame):
    filename = frame.abs_path
    if not filename:
        return False
    try:
        filename = filename.split("/")[-1]
    except Exception:
        pass

    if frame.filename == "<anonymous>" and frame.in_app:
        return False
    elif frame.function in fileNameBlocklist:
        return False
    elif filename and not get_file_extension(filename):
        return False
    return True
