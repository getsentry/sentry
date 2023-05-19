import logging
from typing import Any, Callable, Dict, Optional

from sentry.lang.javascript.utils import (
    do_sourcemaps_processing_ab_test,
    should_use_symbolicator_for_sourcemaps,
)
from sentry.lang.native.error import SymbolicationFailed, write_error
from sentry.lang.native.symbolicator import Symbolicator
from sentry.models import EventError, Project
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.utils import metrics
from sentry.utils.http import get_origins
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
    if data_sourcemap := get_path(symbolicated, "data", "sourcemap"):
        frame_meta = new_frame.setdefault("data", {})
        frame_meta["sourcemap"] = data_sourcemap
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
            mapped_errors.append({"type": EventError.JS_MISSING_SOURCE, "url": abs_path})
        elif ty == "missing_source" and not should_skip_missing_source_error(abs_path):
            mapped_errors.append({"type": EventError.JS_MISSING_SOURCE, "url": abs_path})
        elif ty == "missing_sourcemap" and not should_skip_missing_source_error(abs_path):
            mapped_errors.append({"type": EventError.JS_MISSING_SOURCE, "url": abs_path})
        elif ty == "scraping_disabled":
            mapped_errors.append({"type": EventError.JS_SCRAPING_DISABLED, "url": abs_path})
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


def _handles_frame(frame, data):
    if not frame:
        return False

    # skip frames without an `abs_path` or line number
    if not (abs_path := frame.get("abs_path")) or not frame.get("lineno"):
        return False
    # skip "native" frames
    if abs_path in ("native", "[native code]"):
        return False
    # skip builtin node modules
    if data.get("platform") == "node" and not abs_path.startswith(("/", "app:", "webpack:")):
        return False
    return True


def generate_scraping_config(project: Project) -> Dict[str, Any]:
    allow_scraping_org_level = project.organization.get_option("sentry:scrape_javascript", True)
    allow_scraping_project_level = project.get_option("sentry:scrape_javascript", True)
    allow_scraping = allow_scraping_org_level and allow_scraping_project_level

    allowed_origins = []
    scraping_headers = {}
    if allow_scraping:
        allowed_origins = list(get_origins(project))

        token = project.get_option("sentry:token")
        if token:
            token_header = project.get_option("sentry:token_header") or "X-Sentry-Token"
            scraping_headers[token_header] = token

    return {
        "enabled": allow_scraping,
        "headers": scraping_headers,
        "allowed_origins": allowed_origins,
    }


def process_js_stacktraces(symbolicator: Symbolicator, data: Any) -> Any:
    project = symbolicator.project
    scraping_config = generate_scraping_config(project)

    modules = sourcemap_images_from_data(data)

    stacktrace_infos = find_stacktraces_in_data(data)
    stacktraces = [
        {
            "frames": [
                dict(frame)
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
        scraping_config=scraping_config,
    )

    if not _handle_response_status(data, response):
        return data

    should_do_ab_test = do_sourcemaps_processing_ab_test()
    symbolicator_stacktraces = []

    processing_errors = response.get("errors", [])
    if len(processing_errors) > 0 and not should_do_ab_test:
        data.setdefault("errors", []).extend(map_symbolicator_process_js_errors(processing_errors))

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
                new_frames.append(sinfo_frame)
                continue

            raw_frame = raw_stacktrace["frames"][processed_frame_idx]
            complete_frame = complete_stacktrace["frames"][processed_frame_idx]
            processed_frame_idx += 1

            merged_context_frame = _merge_frame_context(sinfo_frame, raw_frame)
            new_raw_frames.append(merged_context_frame)

            merged_frame = _merge_frame(merged_context_frame, complete_frame)
            new_frames.append(merged_frame)

        # NOTE: we do *not* write the symbolicated frames into `data` (via the `sinfo` indirection)
        # but we rather write that to a different event property that we will use for A/B testing.
        if should_do_ab_test:
            symbolicator_stacktraces.append(new_frames)
        else:
            sinfo.stacktrace["frames"] = new_frames

            if sinfo.container is not None:
                sinfo.container["raw_stacktrace"] = {
                    "frames": new_raw_frames,
                }

    if should_do_ab_test:
        data["symbolicator_stacktraces"] = symbolicator_stacktraces
    else:
        data["processed_by_symbolicator"] = True

    return data


def get_js_symbolication_function(data: Any) -> Optional[Callable[[Symbolicator, Any], Any]]:
    if should_use_symbolicator_for_sourcemaps(data.get("project")):
        return process_js_stacktraces
    return None
