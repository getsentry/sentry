import logging
import re
from collections.abc import Mapping
from typing import Any

import orjson

from sentry.attachments import CachedAttachment, attachment_cache
from sentry.ingest.consumer.processors import CACHE_TIMEOUT
from sentry.lang.java.utils import JAVA_PLATFORMS, get_jvm_images, get_proguard_images
from sentry.lang.native.error import SymbolicationFailed, write_error
from sentry.lang.native.symbolicator import Symbolicator
from sentry.models.eventerror import EventError
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.utils import metrics
from sentry.utils.cache import cache_key_for_event
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


def _merge_frame(new_frame: dict[str, Any], symbolicated: dict[str, Any]) -> None:
    """Merges `symbolicated` into `new_frame`. This updates
    `new_frame` in place."""

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

    if symbolicated.get("pre_context"):
        new_frame["pre_context"] = symbolicated["pre_context"]
    if symbolicated.get("context_line"):
        new_frame["context_line"] = symbolicated["context_line"]
    if symbolicated.get("post_context"):
        new_frame["post_context"] = symbolicated["post_context"]


def _handles_frame(frame: dict[str, Any], platform: str) -> bool:
    "Returns whether the frame should be symbolicated by JVM symbolication."

    return (
        "function" in frame
        and "module" in frame
        and (frame.get("platform", None) or platform) in JAVA_PLATFORMS
    )


FRAME_FIELDS = ("platform", "abs_path", "lineno", "function", "module", "filename", "in_app")


def _normalize_frame(raw_frame: dict[str, Any], index: int) -> dict[str, Any]:
    "Normalizes the frame into just the fields necessary for symbolication and adds an index."

    frame = {"index": index}
    for key in FRAME_FIELDS:
        if (value := raw_frame.get(key)) is not None:
            frame[key] = value

    return frame


def _get_exceptions_for_symbolication(data: Mapping[str, Any]) -> list[dict[str, Any]]:
    "Returns those exceptions in all_exceptions that should be symbolicated."

    return [
        exc
        for exc in get_path(data, "exception", "values", filter=True, default=())
        if exc.get("type", None) and exc.get("module", None)
    ]


def _handle_response_status(event_data: Any, response_json: dict[str, Any]) -> bool | None:
    """Checks the response from Symbolicator and reports errors.
    Returns `True` on success."""

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
    return None


def _get_release_package(project: Project, release_name: str | None) -> str | None:
    """Gets the release package for the given project and release."""

    if not release_name:
        return None

    release = Release.get(project=project, version=release_name)
    return release.package if release else None


def _get_window_class_names(attachments: list[CachedAttachment]) -> list[str]:
    """Returns the class names of all windows in all view hierarchies
    contained in `attachments`."""

    class_names = []
    windows_to_deobfuscate = []

    for attachment in attachments:
        if attachment.type == "event.view_hierarchy":
            view_hierarchy = orjson.loads(attachment_cache.get_data(attachment))
            windows_to_deobfuscate.extend(view_hierarchy.get("windows"))

    while windows_to_deobfuscate:
        window = windows_to_deobfuscate.pop()
        if window.get("type") is not None:
            class_names.append(window["type"])
        if children := window.get("children"):
            windows_to_deobfuscate.extend(children)

    return class_names


def _deobfuscate_view_hierarchy(view_hierarchy: Any, class_names: dict[str, str]) -> None:
    """Deobfuscates a view hierarchy in-place.

    The `class_names` dict is used to resolve obfuscated to deobfuscated names. If
    an obfuscated class name isn't present in `class_names`, it is left unchanged."""

    windows_to_deobfuscate = [*view_hierarchy.get("windows")]

    while windows_to_deobfuscate:
        window = windows_to_deobfuscate.pop()
        if (
            window.get("type") is not None
            and (mapped_type := class_names.get(window["type"])) is not None
        ):
            window["type"] = mapped_type
        if children := window.get("children"):
            windows_to_deobfuscate.extend(children)


def _deobfuscate_view_hierarchies(
    attachments: list[CachedAttachment], class_names: dict[str, str]
) -> list[CachedAttachment]:
    """Deobfuscates all view hierarchies contained in `attachments`, returning a new list of attachments.

    Non-view-hierarchy attachments are unchanged.
    """
    new_attachments = []
    for attachment in attachments:
        if attachment.type == "event.view_hierarchy":
            view_hierarchy = orjson.loads(attachment_cache.get_data(attachment))
            _deobfuscate_view_hierarchy(view_hierarchy, class_names)
            # Reupload to cache as a unchunked data
            new_attachments.append(
                CachedAttachment(
                    type=attachment.type,
                    id=attachment.id,
                    name=attachment.name,
                    content_type=attachment.content_type,
                    data=orjson.dumps(view_hierarchy),
                    chunks=None,
                )
            )
        else:
            new_attachments.append(attachment)

    return new_attachments


def map_symbolicator_process_jvm_errors(
    errors: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    "Maps processing errors reported by Symbolicator to existing Python errors."

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
    """Uses Symbolicator to symbolicate a JVM event."""

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

    processable_exceptions = _get_exceptions_for_symbolication(data)
    cache_key = cache_key_for_event(data)
    attachments = [*attachment_cache.get(cache_key)]
    window_class_names = _get_window_class_names(attachments)

    metrics.incr("proguard.symbolicator.events")

    if (
        not any(stacktrace["frames"] for stacktrace in stacktraces)
        and not processable_exceptions
        and not window_class_names
    ):
        metrics.incr("proguard.symbolicator.events.skipped")
        return

    release_package = _get_release_package(symbolicator.project, data.get("release"))
    metrics.incr("process.java.symbolicate.request")
    response = symbolicator.process_jvm(
        platform=data.get("platform"),
        exceptions=[
            {"module": exc["module"], "type": exc["type"]} for exc in processable_exceptions
        ],
        stacktraces=stacktraces,
        modules=modules,
        release_package=release_package,
        classes=window_class_names,
    )

    if not _handle_response_status(data, response):
        return

    processing_errors = response.get("errors", [])
    if processing_errors:
        data.setdefault("errors", []).extend(map_symbolicator_process_jvm_errors(processing_errors))

    for sinfo, complete_stacktrace in zip(stacktrace_infos, response["stacktraces"]):
        raw_frames = sinfo.stacktrace["frames"]
        complete_frames = complete_stacktrace["frames"]
        new_frames = []

        for index, raw_frame in enumerate(raw_frames):
            # If symbolicator returned any matching frames for this raw_frame, use them,
            # otherwise use the raw_frame itself.
            matching_frames = [frame for frame in complete_frames if frame["index"] == index]
            if matching_frames:
                for returned in matching_frames:
                    new_frame = dict(raw_frame)
                    _merge_frame(new_frame, returned)
                    new_frames.append(new_frame)
            else:
                new_frames.append(raw_frame)

        sinfo.stacktrace["frames"] = new_frames

        if sinfo.container is not None:
            sinfo.container["raw_stacktrace"] = {
                "frames": raw_frames,
            }

    for raw_exc, exc in zip(processable_exceptions, response["exceptions"]):
        raw_exc["module"] = exc["module"]
        raw_exc["type"] = exc["type"]

    classes = response.get("classes")
    new_attachments = _deobfuscate_view_hierarchies(attachments, classes)
    attachment_cache.set(cache_key, attachments=new_attachments, timeout=CACHE_TIMEOUT)

    return data
