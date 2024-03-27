import logging
import re
from typing import Any

from sentry.lang.java.utils import get_jvm_images, get_proguard_images
from sentry.lang.native.error import SymbolicationFailed, write_error
from sentry.lang.native.symbolicator import Symbolicator
from sentry.models.eventerror import EventError
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.utils import metrics
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


def deobfuscate_exception_value(data: Any) -> Any:
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


def _merge_frame_context(new_frame: dict[str, Any], symbolicated: dict[str, Any]):
    if symbolicated.get("pre_context"):
        new_frame["pre_context"] = symbolicated["pre_context"]
    if symbolicated.get("context_line"):
        new_frame["context_line"] = symbolicated["context_line"]
    if symbolicated.get("post_context"):
        new_frame["post_context"] = symbolicated["post_context"]


def _merge_frame(new_frame: dict[str, Any], symbolicated: dict[str, Any]):
    _merge_frame_context(new_frame, symbolicated)

    if symbolicated.get("function"):
        new_frame["function"] = symbolicated["function"]

    if symbolicated.get("abs_path"):
        new_frame["abs_path"] = symbolicated["abs_path"]

    # Clear abs_path if Symbolicator unset it
    elif new_frame.get("abs_path"):
        del new_frame["abs_path"]

    if symbolicated.get("filename"):
        new_frame["filename"] = symbolicated["filename"]

    # Clear abs_path if Symbolicator unset it
    elif new_frame.get("filename"):
        del new_frame["filename"]

    if symbolicated.get("lineno") is not None:
        new_frame["lineno"] = symbolicated["lineno"]
    if symbolicated.get("module"):
        new_frame["module"] = symbolicated["module"]
    if symbolicated.get("in_app") is not None:
        new_frame["in_app"] = symbolicated["in_app"]


def _handles_frame(frame: dict[str, Any], platform: str) -> bool:
    return (
        "function" in frame and "module" in frame and (frame.get("platform") or platform) == "java"
    )


FRAME_FIELDS = ("abs_path", "lineno", "function", "module", "filename", "in_app")


def _normalize_frame(raw_frame: Any, index: int) -> dict:
    frame = {"index": index}
    for key in FRAME_FIELDS:
        if (value := raw_frame.get(key)) is not None:
            frame[key] = value

    return frame


def _get_exceptions_for_symbolication(data: Any) -> list[dict[str, Any]]:
    exceptions = []

    for exc in get_path(data, "exception", "values", filter=True, default=()):
        if exc.get("type") is not None and exc.get("module") is not None:
            exceptions.append({"type": exc["type"], "module": exc["module"]})
    return exceptions


def _handle_response_status(event_data: Any, response_json: dict[str, Any]):
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


def _get_release_package(project: Project, release_name: str | None) -> str | None:
    if not release_name:
        return None

    release = Release.get(project=project, version=release_name)
    return release.package if release else None


def map_symbolicator_process_jvm_errors(
    errors: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
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
        # according to the `test_error_on_resolving` test, a completely
        # broken file should result in a `PROGUARD_MISSING_LINENO` error
        elif ty == "no_line_info" or ty == "invalid":
            mapped_errors.append(
                {
                    "symbolicator_type": ty,
                    "type": EventError.PROGUARD_MISSING_LINENO,
                    "mapping_uuid": uuid,
                }
            )

    return mapped_errors


def process_jvm_stacktraces(symbolicator: Symbolicator, data: Any) -> Any:
    modules = []
    modules.extend([{"uuid": id, "type": "proguard"} for id in get_proguard_images(data)])
    modules.extend([{"uuid": id, "type": "source"} for id in get_jvm_images(data)])

    stacktrace_infos = find_stacktraces_in_data(data)
    stacktraces = [
        {
            "frames": [
                _normalize_frame(frame, index)
                for index, frame in enumerate(sinfo.stacktrace.get("frames") or ())
                if _handles_frame(frame, data.get("platform", "unknown"))
            ],
        }
        for sinfo in stacktrace_infos
    ]

    exceptions = _get_exceptions_for_symbolication(data)

    metrics.incr("proguard.symbolicator.events")

    if not any(stacktrace["frames"] for stacktrace in stacktraces) and not exceptions:
        metrics.incr("proguard.symbolicator.events.skipped")
        return

    release_package = _get_release_package(symbolicator.project, data.get("release"))
    metrics.incr("process.java.symbolicate.request")
    response = symbolicator.process_jvm(
        exceptions=exceptions,
        stacktraces=stacktraces,
        modules=modules,
        release_package=release_package,
    )

    if not _handle_response_status(data, response):
        return

    data["processed_by_symbolicator"] = True

    processing_errors = response.get("errors", [])
    if len(processing_errors) > 0:
        data.setdefault("errors", []).extend(map_symbolicator_process_jvm_errors(processing_errors))

    assert len(stacktraces) == len(response["stacktraces"]), (stacktraces, response)

    for sinfo, complete_stacktrace in zip(stacktrace_infos, response["stacktraces"]):
        raw_frames = sinfo.stacktrace["frames"]
        complete_frames = complete_stacktrace["frames"]
        sinfo.stacktrace["frames"] = []

        for index, raw_frame in enumerate(raw_frames):
            # If symbolicator returned any matching frames for this raw_frame, use them,
            # otherwise use the raw_frame itself.
            matching_frames = [frame for frame in complete_frames if frame["index"] == index]
            if matching_frames:
                for returned in matching_frames:
                    new_frame = dict(raw_frame)
                    _merge_frame(new_frame, returned)
                    sinfo.stacktrace["frames"].append(new_frame)
            else:
                sinfo.stacktrace["frames"].append(raw_frame)

        if sinfo.container is not None:
            sinfo.container["raw_stacktrace"] = {
                "frames": raw_frames,
            }

    assert len(exceptions) == len(response["exceptions"])

    # NOTE: we are using the `data.exception.values` directory here
    for exception, complete_exception in zip(
        get_path(data, "exception", "values", filter=True, default=()),
        response["exceptions"],
    ):
        exception["type"] = complete_exception["type"]
        exception["module"] = complete_exception["module"]

    return data
