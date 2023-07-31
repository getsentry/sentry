from sentry.models import EventError, PromptsActivity

fileNameBlocklist = ["@webkit-masked-url"]

priority = {EventError.JS_INVALID_SOURCEMAP: 2, EventError.JS_NO_COLUMN: 3}

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


def find_debug_frames(event):
    debug_frames = []
    exceptions = event.exception.values
    seen_filenames = []

    for exception_idx, exception in enumerate(exceptions):
        for frame_idx, frame in enumerate(exception.stacktrace.frames):
            if frame.in_app and frame.filename not in seen_filenames:
                debug_frames.append((frame_idx, exception_idx))
                seen_filenames.append(frame.filename)

    return debug_frames


def get_file_extension(filename):
    segments = filename.split(".")
    if len(segments) > 1:
        return segments[-1]
    return None


def is_frame_filename_invalid(frame):
    filename = frame.get("abs_path")
    if not filename:
        return True
    try:
        filename = filename.split("/")[-1]
    except Exception:
        pass

    if frame.get("filename") == "<anonymous>" and frame.get("in_app"):
        return True
    elif frame.get("function") in fileNameBlocklist:
        return True
    elif filename and not get_file_extension(filename):
        return True
    return False


def find_prompts_activity(organization_id, project_id, user_id, feature):
    return PromptsActivity.objects.filter(
        organization_id__in=organization_id, feature=feature, user_id=user_id
    )
