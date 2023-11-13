import logging
import re
from typing import Any

from sentry.debug_files.artifact_bundles import maybe_renew_artifact_bundles_from_processing
from sentry.lang.native.error import SymbolicationFailed, write_error
from sentry.lang.native.symbolicator import Symbolicator
from sentry.models.eventerror import EventError
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.utils import metrics
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

# Matches "app:", "webpack:",
# "x:" where x is a single ASCII letter, or "/".
NON_BUILTIN_PATH_REGEX = re.compile(r"^((app|webpack|[a-zA-Z]):|/)")


def _merge_frame_context(new_frame, symbolicated):
    new_frame = dict(new_frame)
    symbolicated = dict(symbolicated)

    if symbolicated.get("pre_context"):
        new_frame["pre_context"] = symbolicated["pre_context"]
    if symbolicated.get("context_line"):
        new_frame["context_line"] = symbolicated["context_line"]
    if symbolicated.get("post_context"):
        new_frame["post_context"] = symbolicated["post_context"]

    return new_frame


def _merge_frame(new_frame, symbolicated):
    new_frame = dict(new_frame)
    symbolicated = dict(symbolicated)

    if symbolicated.get("function"):
        new_frame["function"] = symbolicated["function"]
    if symbolicated.get("abs_path"):
        new_frame["abs_path"] = symbolicated["abs_path"]
    if symbolicated.get("filename"):
        new_frame["filename"] = symbolicated["filename"]
    if symbolicated.get("lineno"):
        new_frame["lineno"] = symbolicated["lineno"]
    if symbolicated.get("colno"):
        new_frame["colno"] = symbolicated["colno"]
    if symbolicated.get("pre_context"):
        new_frame["pre_context"] = symbolicated["pre_context"]
    if symbolicated.get("context_line"):
        new_frame["context_line"] = symbolicated["context_line"]
    if symbolicated.get("post_context"):
        new_frame["post_context"] = symbolicated["post_context"]
    if data := symbolicated.get("data"):
        frame_meta = new_frame.setdefault("data", {})
        if data_sourcemap := data.get("sourcemap"):
            frame_meta["sourcemap"] = data_sourcemap
        if data_resolved_with := data.get("resolved_with"):
            frame_meta["resolved_with"] = data_resolved_with
        if data.get("symbolicated") is not None:
            frame_meta["symbolicated"] = data["symbolicated"]
    if symbolicated.get("module"):
        new_frame["module"] = symbolicated["module"]
    if symbolicated.get("in_app") is not None:
        new_frame["in_app"] = symbolicated["in_app"]
    # if symbolicated.get("status"):
    # NOTE: We don't need this currently, and it's not clear whether we'll use it at all.
    # frame_meta["symbolicator_status"] = symbolicated["status"]

    return new_frame


# TODO: Change this error handling to be JS-specific?
def _handle_response_status(event_data, response_json):
    if not response_json:
        error = SymbolicationFailed(type=EventError.NATIVE_INTERNAL_FAILURE)
    elif response_json["status"] == "completed":
        return True
    elif response_json["status"] == "failed":
        error = SymbolicationFailed(
            message=response_json.get("message") or None, type=EventError.NATIVE_SYMBOLICATOR_FAILED
        )
    else:
        logger.error("Unexpected symbolicator status: %s", response_json["status"])
        error = SymbolicationFailed(type=EventError.NATIVE_INTERNAL_FAILURE)

    write_error(error, event_data)


def is_sourcemap_image(image):
    return (
        bool(image)
        and image.get("type") == "sourcemap"
        and image.get("debug_id") is not None
        and image.get("code_file") is not None
    )


def sourcemap_images_from_data(data):
    return get_path(data, "debug_meta", "images", default=(), filter=is_sourcemap_image)


# Most people don't upload release artifacts for their third-party libraries,
# so ignore missing node_modules files or chrome extensions
def should_skip_missing_source_error(abs_path):
    "node_modules" in abs_path or abs_path.startswith("chrome-extension:")


def map_symbolicator_process_js_errors(errors):
    if errors is None:
        return []

    mapped_errors = []

    for error in errors:
        ty = error["type"]
        abs_path = error["abs_path"]

        if ty == "invalid_abs_path" and not should_skip_missing_source_error(abs_path):
            mapped_errors.append(
                {
                    "symbolicator_type": ty,
                    "type": EventError.JS_MISSING_SOURCE,
                    "url": abs_path,
                }
            )
        elif ty == "missing_source" and not should_skip_missing_source_error(abs_path):
            mapped_errors.append(
                {"symbolicator_type": ty, "type": EventError.JS_MISSING_SOURCE, "url": abs_path}
            )
        elif ty == "missing_sourcemap" and not should_skip_missing_source_error(abs_path):
            mapped_errors.append(
                {"symbolicator_type": ty, "type": EventError.JS_MISSING_SOURCE, "url": abs_path}
            )
        elif ty == "scraping_disabled":
            mapped_errors.append(
                {"symbolicator_type": ty, "type": EventError.JS_SCRAPING_DISABLED, "url": abs_path}
            )
        elif ty == "malformed_sourcemap":
            mapped_errors.append(
                {
                    "symbolicator_type": ty,
                    "type": EventError.JS_INVALID_SOURCEMAP,
                    "url": error["url"],
                }
            )
        elif ty == "missing_source_content":
            mapped_errors.append(
                {
                    "symbolicator_type": ty,
                    "type": EventError.JS_MISSING_SOURCES_CONTENT,
                    "source": error["source"],
                    "sourcemap": error["sourcemap"],
                }
            )
        elif ty == "invalid_location":
            mapped_errors.append(
                {
                    "symbolicator_type": ty,
                    "type": EventError.JS_INVALID_SOURCEMAP_LOCATION,
                    "column": error["col"],
                    "row": error["line"],
                    "source": abs_path,
                }
            )

    return mapped_errors


def _handles_frame(frame, data):
    abs_path = frame.get("abs_path")

    # Skip frames without an `abs_path` or line number
    if not abs_path or not frame.get("lineno"):
        return False

    # Skip "native" frames
    if _is_native_frame(abs_path):
        return False

    # Skip builtin node modules
    if _is_built_in(abs_path, data.get("platform")):
        return False

    return True


def _is_native_frame(abs_path):
    return abs_path in ("native", "[native code]")


def _is_built_in(abs_path, platform):
    return platform == "node" and not NON_BUILTIN_PATH_REGEX.match(abs_path)


# We want to make sure that some specific frames are always marked as non-inapp prior to going into grouping.
def _normalize_nonhandled_frame(frame, data):
    abs_path = frame.get("abs_path")

    if abs_path and (_is_native_frame(abs_path) or _is_built_in(abs_path, data.get("platform"))):
        frame["in_app"] = False

    return frame


FRAME_FIELDS = ("abs_path", "lineno", "colno", "function")


def _normalize_frame(raw_frame: Any) -> dict:
    frame = {}
    for key in FRAME_FIELDS:
        if (value := raw_frame.get(key)) is not None:
            frame[key] = value

    return frame


def process_js_stacktraces(symbolicator: Symbolicator, data: Any) -> Any:
    modules = sourcemap_images_from_data(data)

    stacktrace_infos = find_stacktraces_in_data(data)
    stacktraces = [
        {
            "frames": [
                _normalize_frame(frame)
                for frame in sinfo.stacktrace.get("frames") or ()
                if _handles_frame(frame, data)
            ],
        }
        for sinfo in stacktrace_infos
    ]

    metrics.incr("sourcemaps.symbolicator.events")

    if not any(stacktrace["frames"] for stacktrace in stacktraces):
        metrics.incr("sourcemaps.symbolicator.events.skipped")
        return

    response = symbolicator.process_js(
        stacktraces=stacktraces,
        modules=modules,
        release=data.get("release"),
        dist=data.get("dist"),
    )

    if not _handle_response_status(data, response):
        return data

    used_artifact_bundles = response.get("used_artifact_bundles", [])
    if used_artifact_bundles:
        maybe_renew_artifact_bundles_from_processing(symbolicator.project.id, used_artifact_bundles)

    processing_errors = response.get("errors", [])
    if len(processing_errors) > 0:
        data.setdefault("errors", []).extend(map_symbolicator_process_js_errors(processing_errors))
    scraping_attempts = response.get("scraping_attempts", [])
    if len(scraping_attempts) > 0:
        data["scraping_attempts"] = scraping_attempts

    assert len(stacktraces) == len(response["stacktraces"]), (stacktraces, response)

    for sinfo, raw_stacktrace, complete_stacktrace in zip(
        stacktrace_infos, response["raw_stacktraces"], response["stacktraces"]
    ):
        processed_frame_idx = 0
        new_frames = []
        new_raw_frames = []
        for sinfo_frame in sinfo.stacktrace["frames"]:
            if not _handles_frame(sinfo_frame, data):
                new_raw_frames.append(sinfo_frame)
                new_frames.append(_normalize_nonhandled_frame(dict(sinfo_frame), data))
                continue

            raw_frame = raw_stacktrace["frames"][processed_frame_idx]
            complete_frame = complete_stacktrace["frames"][processed_frame_idx]
            processed_frame_idx += 1

            merged_context_frame = _merge_frame_context(sinfo_frame, raw_frame)
            new_raw_frames.append(merged_context_frame)

            merged_frame = _merge_frame(sinfo_frame, complete_frame)
            new_frames.append(merged_frame)

        sinfo.stacktrace["frames"] = new_frames

        if sinfo.container is not None:
            sinfo.container["raw_stacktrace"] = {
                "frames": new_raw_frames,
            }

    return data
