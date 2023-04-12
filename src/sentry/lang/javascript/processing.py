import logging
from typing import Any, Callable

from sentry.lang.javascript.utils import should_use_symbolicator_for_sourcemaps
from sentry.lang.native.error import SymbolicationFailed, write_error
from sentry.lang.native.symbolicator import Symbolicator
from sentry.models import EventError
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


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
    if symbolicated.get("status"):
        new_frame.setdefault("data", {})
        # NOTE: We don't need this currently, and it's not clear whether we'll use it at all.
        # frame_meta = new_frame.setdefault("data", {})
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
            mapped_errors.append({"type": EventError.JS_MISSING_SOURCE, "url": abs_path})
        elif ty == "missing_source" and not should_skip_missing_source_error(abs_path):
            mapped_errors.append({"type": EventError.JS_MISSING_SOURCE, "url": abs_path})
        elif ty == "missing_sourcemap" and not should_skip_missing_source_error(abs_path):
            mapped_errors.append({"type": EventError.JS_MISSING_SOURCE, "url": abs_path})
        elif ty == "malformed_sourcemap":
            mapped_errors.append({"type": EventError.JS_INVALID_SOURCEMAP, "url": error["url"]})
        elif ty == "missing_source_content":
            mapped_errors.append(
                {
                    "type": EventError.JS_MISSING_SOURCES_CONTENT,
                    "source": error["source"],
                    "sourcemap": error["sourcemap"],
                }
            )
        elif ty == "invalid_location":
            mapped_errors.append(
                {
                    "type": EventError.JS_INVALID_SOURCEMAP_LOCATION,
                    "column": error["col"],
                    "row": error["line"],
                    "source": abs_path,
                }
            )

    return mapped_errors


def process_payload(symbolicator: Symbolicator, data: Any) -> Any:
    project = symbolicator.project
    allow_scraping_org_level = project.organization.get_option("sentry:scrape_javascript", True)
    allow_scraping_project_level = project.get_option("sentry:scrape_javascript", True)
    allow_scraping = allow_scraping_org_level and allow_scraping_project_level

    modules = sourcemap_images_from_data(data)

    stacktrace_infos = find_stacktraces_in_data(data)
    stacktraces = [
        {
            "frames": [dict(frame) for frame in sinfo.stacktrace.get("frames") or ()],
        }
        for sinfo in stacktrace_infos
    ]

    if not any(stacktrace["frames"] for stacktrace in stacktraces):
        return

    response = symbolicator.process_js(
        stacktraces=stacktraces,
        modules=modules,
        release=data.get("release"),
        dist=data.get("dist"),
        allow_scraping=allow_scraping,
    )

    if not _handle_response_status(data, response):
        return data

    processing_errors = response.get("errors", [])
    if len(processing_errors) > 0:
        data.setdefault("errors", []).extend(map_symbolicator_process_js_errors(processing_errors))

    # TODO: should this really be a hard assert? Or rather an internal log?
    assert len(stacktraces) == len(response["stacktraces"]), (stacktraces, response)

    for sinfo, raw_stacktrace, complete_stacktrace in zip(
        stacktrace_infos, response["raw_stacktraces"], response["stacktraces"]
    ):
        new_frames = []
        new_raw_frames = []

        for sinfo_frame, raw_frame, complete_frame in zip(
            sinfo.stacktrace["frames"],
            raw_stacktrace["frames"],
            complete_stacktrace["frames"],
        ):
            merged_context_frame = _merge_frame_context(sinfo_frame, raw_frame)
            new_raw_frames.append(merged_context_frame)

            merged_frame = _merge_frame(merged_context_frame, complete_frame)
            new_frames.append(merged_frame)

        if sinfo.container is not None:
            sinfo.container["raw_stacktrace"] = {
                "frames": new_raw_frames,
            }

        sinfo.stacktrace["frames"] = new_frames

    return data


def get_symbolication_function(data: Any) -> Callable[[Symbolicator, Any], Any]:
    if should_use_symbolicator_for_sourcemaps(data.get("project")):
        return process_payload
