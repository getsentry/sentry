from sentry.models import EventError, PromptsActivity, SourceMapProcessingIssue

fileNameBlocklist = ["@webkit-masked-url"]

priority_ranking = {
    EventError.INVALID_DATA: 19,
    EventError.INVALID_ATTRIBUTE: 20,
    EventError.VALUE_TOO_LONG: 11,
    EventError.FUTURE_TIMESTAMP: 12,
    EventError.PAST_TIMESTAMP: 13,
    EventError.CLOCK_DRIFT: 14,
    EventError.INVALID_ENVIRONMENT: 15,
    EventError.SECURITY_VIOLATION: 16,
    EventError.RESTRICTED_IP: 17,
    EventError.FETCH_GENERIC_ERROR: 18,
    EventError.JS_MISSING_SOURCES_CONTENT: 10,
    EventError.JS_SCRAPING_DISABLED: 9,
    EventError.NATIVE_BAD_DSYM: 21,
    EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM: 22,
    EventError.NATIVE_MISSING_DSYM: 23,
    EventError.PROGUARD_MISSING_MAPPING: 24,
    EventError.PROGUARD_MISSING_LINENO: 25,
    SourceMapProcessingIssue.MISSING_RELEASE: 1,
    SourceMapProcessingIssue.MISSING_SOURCEMAPS: 2,
    SourceMapProcessingIssue.URL_NOT_VALID: 3,
    SourceMapProcessingIssue.NO_URL_MATCH: 4,
    SourceMapProcessingIssue.PARTIAL_MATCH: 5,
    SourceMapProcessingIssue.DIST_MISMATCH: 6,
    SourceMapProcessingIssue.SOURCEMAP_NOT_FOUND: 7,
    SourceMapProcessingIssue.DEBUG_ID_NO_SOURCEMAPS: 8,
}

errors_to_hide = [
    EventError.JS_MISSING_SOURCE,
    EventError.JS_INVALID_SOURCEMAP,
    EventError.JS_INVALID_SOURCEMAP_LOCATION,
    EventError.JS_TOO_MANY_REMOTE_SOURCES,
    EventError.JS_INVALID_SOURCE_ENCODING,
    EventError.UNKNOWN_ERROR,
    EventError.MISSING_ATTRIBUTE,
    EventError.NATIVE_NO_CRASHED_THREAD,
    EventError.NATIVE_INTERNAL_FAILURE,
    EventError.NATIVE_MISSING_SYSTEM_DSYM,
    EventError.NATIVE_MISSING_SYMBOL,
    EventError.NATIVE_SIMULATOR_FRAME,
    EventError.NATIVE_UNKNOWN_IMAGE,
    EventError.NATIVE_SYMBOLICATOR_FAILED,
]

deprecated_event_errors = [
    EventError.FETCH_TOO_LARGE,
    EventError.FETCH_INVALID_ENCODING,
    EventError.FETCH_TIMEOUT,
    EventError.FETCH_INVALID_HTTP_CODE,
    EventError.JS_INVALID_CONTENT,
    EventError.TOO_LARGE_FOR_CACHE,
    EventError.JS_NO_COLUMN,
]


# These checks mirror what we do in the front end in getUniqueFilesFromException
def find_debug_frames(event):
    max_frames = 5
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

    debug_frames = debug_frames[:max_frames]
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


def find_prompts_activity(organization_id, project_id, user_id, features):
    return PromptsActivity.objects.filter(
        organization_id=organization_id,
        feature__in=features,
        user_id=user_id,
        project_id=project_id,
    )
