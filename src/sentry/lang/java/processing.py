import logging
import re
from typing import Any

from sentry.lang.java.utils import get_proguard_images
from sentry.lang.native.error import SymbolicationFailed, write_error
from sentry.lang.native.symbolicator import Symbolicator
from sentry.models.eventerror import EventError
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.utils import metrics
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


def deobfuscate_exception_value(data):
    # Deobfuscate the exception value by regex replacing
    # Mapping constructed by taking the last lines from the deobfuscated stacktrace and raw stacktrace
    exception = get_path(data, "exception", "values", -1)
    frame = get_path(exception, "stacktrace", "frames", -1)
    raw_frame = get_path(exception, "raw_stacktrace", "frames", -1)
    if (
        frame
        and raw_frame
        and frame.get("module")
        and frame.get("function")
        and exception.get("value")
    ):
        deobfuscated_method_name = f"{frame['module']}.{frame['function']}"
        raw_method_name = f"{raw_frame['module']}.{raw_frame['function']}"
        exception["value"] = re.sub(
            re.escape(raw_method_name), deobfuscated_method_name, exception["value"]
        )

    return data


def _merge_frame_context(new_frame, symbolicated):
    if symbolicated.get("pre_context"):
        new_frame["pre_context"] = symbolicated["pre_context"]
    if symbolicated.get("context_line"):
        new_frame["context_line"] = symbolicated["context_line"]
    if symbolicated.get("post_context"):
        new_frame["post_context"] = symbolicated["post_context"]

    return new_frame


def _merge_frame(new_frame, symbolicated):
    _merge_frame_context(new_frame, symbolicated)

    if symbolicated.get("function"):
        new_frame["function"] = symbolicated["function"]
    if symbolicated.get("abs_path"):
        new_frame["abs_path"] = symbolicated["abs_path"]
    if symbolicated.get("filename"):
        new_frame["filename"] = symbolicated["filename"]
    if symbolicated.get("lineno"):
        new_frame["lineno"] = symbolicated["lineno"]
    if symbolicated.get("module"):
        new_frame["module"] = symbolicated["module"]
    if symbolicated.get("in_app") is not None:
        new_frame["in_app"] = symbolicated["in_app"]


def _handles_frame(frame, data):
    # Skip frames without function or module
    return "function" in frame and "module" in frame


FRAME_FIELDS = ("abs_path", "lineno", "function", "module", "filename", "in_app")


def _normalize_frame(raw_frame: Any) -> dict:
    frame = {}
    for key in FRAME_FIELDS:
        if (value := raw_frame.get(key)) is not None:
            frame[key] = value

    return frame


def get_frames_for_symbolication(frames, data):
    return [dict(frame) for frame in reversed(frames)]


def _get_exceptions_for_symbolication(data):
    exceptions = []

    for exc in get_path(data, "exception", "values", filter=True, default=()):
        if exc.get("type") is not None and exc.get("module") is not None:
            exceptions.append({"type": exc["type"], "module": exc["module"]})


def _handle_response_status(event_data, response_json):
    if not response_json:
        error = SymbolicationFailed(type=EventError.NATIVE_INTERNAL_FAILURE)
    elif response_json["status"] == "completed":
        return True
    elif response_json["status"] == "failed":
        error = SymbolicationFailed(
            message=response_json.get("message") or None,
            type=EventError.NATIVE_SYMBOLICATOR_FAILED,
        )
    else:
        logger.error("Unexpected symbolicator status: %s", response_json["status"])
        error = SymbolicationFailed(type=EventError.NATIVE_INTERNAL_FAILURE)

    write_error(error, event_data)


def map_symbolicator_process_jvm_errors(errors):
    if errors is None:
        return []

    mapped_errors = []

    for error in errors:
        ty = error["type"]
        uuid = error["uuid"]

        if ty == "missing":
            mapped_errors.append(
                {
                    "symbolicator_type": ty,
                    "type": EventError.PROGUARD_MISSING_MAPPING,
                    "mapping_uuid": uuid,
                }
            )
        elif ty == "no_line_info":
            mapped_errors.append(
                {
                    "symbolicator_type": ty,
                    "type": EventError.PROGUARD_MISSING_LINENO,
                    "mapping_uuid": uuid,
                }
            )
        elif ty == "invalid":
            # WAT DO?
            pass

    return mapped_errors


def process_jvm_stacktraces(symbolicator: Symbolicator, data: Any) -> Any:
    modules = [{"uuid": id} for id in get_proguard_images(data)]

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

    exceptions = _get_exceptions_for_symbolication(data)

    metrics.incr("proguard.symbolicator.events")

    if not any(stacktrace["frames"] for stacktrace in stacktraces) and not exceptions:
        metrics.incr("proguard.symbolicator.events.skipped")
        return

    metrics.incr("process.java.symbolicate.request")
    response = symbolicator.process_jvm(
        exceptions=exceptions,
        stacktraces=stacktraces,
        modules=modules,
        # TODO:
        release_package=None,
        # release_package=data.get("release"),
    )

    if not _handle_response_status(data, response):
        return data

    processing_errors = response.get("errors", [])
    if len(processing_errors) > 0:
        data.setdefault("errors", []).extend(map_symbolicator_process_jvm_errors(processing_errors))

    assert len(stacktraces) == len(response["stacktraces"]), (stacktraces, response)

    for sinfo, complete_stacktrace in zip(stacktrace_infos, response["stacktraces"]):
        processed_frame_idx = 0
        new_frames = []
        raw_frames = sinfo.stacktrace["frames"]
        for sinfo_frame in sinfo.stacktrace["frames"]:
            if not _handles_frame(sinfo_frame, data):
                new_frames.append(sinfo_frame)
                continue

            complete_frame = complete_stacktrace["frames"][processed_frame_idx]
            processed_frame_idx += 1

            merged_frame = _merge_frame(sinfo_frame, complete_frame)
            new_frames.append(merged_frame)

        sinfo.stacktrace["frames"] = new_frames

        if sinfo.container is not None:
            sinfo.container["raw_stacktrace"] = {
                "frames": raw_frames,
            }

    assert len(exceptions) == len(response["exceptions"])

    # NOTE: we are using the `data.exception.values` directory here
    for exception, complete_exception in zip(
        get_path(data, "exception", "values", filter=True, default=()), response["exceptions"]
    ):
        exception["type"] = complete_exception["type"]
        exception["module"] = complete_exception["module"]

    return data
