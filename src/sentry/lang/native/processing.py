from __future__ import annotations

import logging
import posixpath
from collections.abc import Callable, Mapping
from typing import Any

import sentry_sdk
from symbolic.debuginfo import normalize_debug_id
from symbolic.exceptions import ParseDebugIdError

from sentry import options
from sentry.features.rollout import in_random_rollout
from sentry.lang.native.error import SymbolicationFailed, write_error
from sentry.lang.native.symbolicator import Symbolicator
from sentry.lang.native.utils import (
    get_event_attachment,
    get_os_from_event,
    image_name,
    is_applecrashreport_event,
    is_minidump_event,
    is_native_event,
    is_native_platform,
    native_images_from_data,
    signal_from_data,
)
from sentry.models.eventerror import EventError
from sentry.stacktraces.functions import trim_function_name
from sentry.stacktraces.processing import StacktraceInfo, find_stacktraces_in_data
from sentry.utils import metrics
from sentry.utils.in_app import is_known_third_party, is_optional_package
from sentry.utils.safe import get_path, set_path, setdefault_path, trim

logger = logging.getLogger(__name__)


IMAGE_STATUS_FIELDS = frozenset(("unwind_status", "debug_status"))

# Attachment type used for minidump files
MINIDUMP_ATTACHMENT_TYPE = "event.minidump"

# Attachment type used for Apple Crash Reports
APPLECRASHREPORT_ATTACHMENT_TYPE = "event.applecrashreport"


def _merge_frame(new_frame, symbolicated, platform="native"):
    # il2cpp events which have the "csharp" platform have good (C#) names
    # coming from the SDK, we do not want to override those with bad (mangled) C++ names.
    if platform != "csharp" and symbolicated.get("function"):
        raw_func = trim(symbolicated["function"], 256)
        func = trim(trim_function_name(symbolicated["function"], platform), 256)

        # if function and raw function match, we can get away without
        # storing a raw function
        if func == raw_func:
            new_frame["function"] = raw_func
        # otherwise we store both
        else:
            new_frame["raw_function"] = raw_func
            new_frame["function"] = func
    if symbolicated.get("instruction_addr"):
        new_frame["instruction_addr"] = symbolicated["instruction_addr"]
    if symbolicated.get("function_id"):
        new_frame["function_id"] = symbolicated["function_id"]
    if symbolicated.get("symbol"):
        new_frame["symbol"] = symbolicated["symbol"]
    if symbolicated.get("abs_path"):
        new_frame["abs_path"] = symbolicated["abs_path"]
        new_frame["filename"] = posixpath.basename(symbolicated["abs_path"])
    if symbolicated.get("filename"):
        new_frame["filename"] = symbolicated["filename"]
    if symbolicated.get("lineno"):
        new_frame["lineno"] = symbolicated["lineno"]
    if symbolicated.get("colno"):
        new_frame["colno"] = symbolicated["colno"]
    # similarly as with `function` above, we do want to retain the original "package".
    if platform != "csharp" and symbolicated.get("package"):
        new_frame["package"] = symbolicated["package"]
    if symbolicated.get("trust"):
        new_frame["trust"] = symbolicated["trust"]
    if symbolicated.get("pre_context"):
        new_frame["pre_context"] = symbolicated["pre_context"]
    if symbolicated.get("context_line") is not None:
        new_frame["context_line"] = symbolicated["context_line"]
    if symbolicated.get("post_context"):
        new_frame["post_context"] = symbolicated["post_context"]
    if symbolicated.get("source_link"):
        new_frame["source_link"] = symbolicated["source_link"]

    addr_mode = symbolicated.get("addr_mode")
    if addr_mode is None:
        new_frame.pop("addr_mode", None)
    else:
        new_frame["addr_mode"] = addr_mode

    if symbolicated.get("status"):
        frame_meta = new_frame.setdefault("data", {})
        frame_meta["symbolicator_status"] = symbolicated["status"]


def _handle_image_status(status, image, os, data):
    if status in ("found", "unused"):
        return
    elif status == "unsupported":
        error = SymbolicationFailed(type=EventError.NATIVE_UNSUPPORTED_DSYM)
    elif status == "missing":
        package = image.get("code_file")
        if not package:
            return
        # TODO(mitsuhiko): This check seems wrong?  This call seems to
        # mirror the one in the ios symbol server support.  If we change
        # one we need to change the other.
        if is_known_third_party(package, os):
            return

        # FIXME(swatinem): .NET never had debug images before, and it is possible
        # to send fully symbolicated events from the SDK.
        # Updating to an SDK that does send images would otherwise trigger these
        # errors all the time if debug files were missing, even though the event
        # was already fully symbolicated on the client.
        # We are just completely filtering out these errors here. Ideally, we
        # would rather do this selectively, only for images that were referenced
        # from non-symbolicated frames.
        if image.get("type") == "pe_dotnet":
            return

        if is_optional_package(package):
            error = SymbolicationFailed(type=EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM)
        else:
            error = SymbolicationFailed(type=EventError.NATIVE_MISSING_DSYM)
    elif status == "malformed":
        error = SymbolicationFailed(type=EventError.NATIVE_BAD_DSYM)
    elif status == "too_large":
        error = SymbolicationFailed(type=EventError.FETCH_TOO_LARGE)
    elif status == "fetching_failed":
        error = SymbolicationFailed(type=EventError.FETCH_GENERIC_ERROR)
    elif status == "other":
        error = SymbolicationFailed(type=EventError.UNKNOWN_ERROR)
    else:
        logger.error("Unknown status: %s", status)
        return

    error.image_arch = image.get("arch")
    error.image_path = image.get("code_file")
    error.image_name = image_name(image.get("code_file"))
    error.image_uuid = image.get("debug_id")

    write_error(error, data)


def _merge_image(raw_image, complete_image, os, data):
    statuses = set()

    # Set image data from symbolicator as symbolicator might know more
    # than the SDK, especially for minidumps
    for k, v in complete_image.items():
        if k in IMAGE_STATUS_FIELDS:
            statuses.add(v)
        if not (v is None or (v == "unknown" and k in ("arch", "type"))):
            raw_image[k] = v

    for status in set(statuses):
        _handle_image_status(status, raw_image, os, data)


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


def _merge_system_info(data, system_info):
    set_path(data, "contexts", "os", "type", value="os")  # Required by "get_os_from_event"

    os_name = system_info.get("os_name")
    os_version = system_info.get("os_version")
    os_build = system_info.get("os_build")

    if os_version:
        setdefault_path(data, "contexts", "os", "version", value=os_version)
    if os_build:
        setdefault_path(data, "contexts", "os", "build", value=os_build)
    if os_name and not os_version and not os_build:
        setdefault_path(data, "contexts", "os", "raw_description", value=os_name)
    elif os_name:
        setdefault_path(data, "contexts", "os", "name", value=os_name)

    set_path(data, "contexts", "device", "type", value="device")
    setdefault_path(data, "contexts", "device", "arch", value=system_info.get("cpu_arch"))

    device_model = system_info.get("device_model")
    if device_model:
        setdefault_path(data, "contexts", "device", "model", value=device_model)


def _merge_full_response(data, response):
    data["platform"] = "native"
    # Specifically for Unreal events: Do not overwrite the level as it has already been set in Relay when merging the context.
    if response.get("crashed") is not None and data.get("level") is None:
        data["level"] = "fatal" if response["crashed"] else "info"

    if response.get("system_info"):
        _merge_system_info(data, response["system_info"])

    os = get_os_from_event(data)

    images: list[dict[str, Any]] = []
    set_path(data, "debug_meta", "images", value=images)

    for complete_image in response["modules"]:
        image: dict[str, Any] = {}
        _merge_image(image, complete_image, os, data)
        images.append(image)

    # Extract the crash reason and infos
    data_exception = get_path(data, "exception", "values", 0)
    if response.get("assertion"):
        data_exception["value"] = "Assertion Error: {}".format(response["assertion"])
    elif response.get("crash_details"):
        data_exception["value"] = response["crash_details"]
    elif response.get("crash_reason"):
        data_exception["value"] = "Fatal Error: {}".format(response["crash_reason"])
    else:
        # We're merging a full response, so there was no initial payload
        # submitted. Assuming that this still contains the placeholder, remove
        # it rather than showing a default value.
        data_exception.pop("value", None)

    if response.get("crash_reason"):
        data_exception["type"] = response["crash_reason"]

    data_threads: list[dict[str, Any]] = []
    if response["stacktraces"]:
        data["threads"] = {"values": data_threads}
    else:
        error = SymbolicationFailed(
            message="minidump has no thread list", type=EventError.NATIVE_SYMBOLICATOR_FAILED
        )
        write_error(error, data)

    for complete_stacktrace in response["stacktraces"]:
        is_requesting = complete_stacktrace.get("is_requesting")
        thread_id = complete_stacktrace.get("thread_id")
        thread_name = complete_stacktrace.get("thread_name")

        data_thread = {"id": thread_id}
        if thread_name:
            data_thread["name"] = thread_name

        if is_requesting:
            if response.get("crashed"):
                data_thread["crashed"] = True
            else:
                data_thread["current"] = True
        data_threads.append(data_thread)

        if is_requesting:
            data_exception["thread_id"] = thread_id
            data_stacktrace = data_exception.setdefault("stacktrace", {})
            data_stacktrace["frames"] = []
        else:
            data_thread["stacktrace"] = data_stacktrace = {"frames": []}

        if complete_stacktrace.get("registers"):
            data_stacktrace["registers"] = complete_stacktrace["registers"]

        for complete_frame in reversed(complete_stacktrace["frames"]):
            new_frame: dict[str, Any] = {}
            _merge_frame(new_frame, complete_frame)
            data_stacktrace["frames"].append(new_frame)


def process_minidump(symbolicator: Symbolicator, data: Any) -> Any:
    minidump = get_event_attachment(data, MINIDUMP_ATTACHMENT_TYPE)
    if not minidump:
        logger.error("Missing minidump for minidump event")
        return

    metrics.incr("process.native.symbolicate.request")
    response = symbolicator.process_minidump(data.get("platform"), minidump.data)

    if _handle_response_status(data, response):
        _merge_full_response(data, response)

        # Emit Apple symbol stats
        apple_symbol_stats = response.get("apple_symbol_stats")
        if apple_symbol_stats:
            try:
                emit_apple_symbol_stats(apple_symbol_stats, data)
            except Exception as e:
                sentry_sdk.capture_exception(e)

    return data


def process_applecrashreport(symbolicator: Symbolicator, data: Any) -> Any:
    report = get_event_attachment(data, APPLECRASHREPORT_ATTACHMENT_TYPE)
    if not report:
        logger.error("Missing applecrashreport for event")
        return

    metrics.incr("process.native.symbolicate.request")
    response = symbolicator.process_applecrashreport(data.get("platform"), report.data)

    if _handle_response_status(data, response):
        _merge_full_response(data, response)

        # Emit Apple symbol stats
        apple_symbol_stats = response.get("apple_symbol_stats")
        if apple_symbol_stats:
            try:
                emit_apple_symbol_stats(apple_symbol_stats, data)
            except Exception as e:
                sentry_sdk.capture_exception(e)

    return data


def _handles_frame(data, frame):
    if not frame:
        return False

    if get_path(frame, "data", "symbolicator_status") is not None:
        return False

    # TODO: Consider ignoring platform
    platform = frame.get("platform") or data.get("platform")
    return is_native_platform(platform) and frame.get("instruction_addr") is not None


def get_frames_for_symbolication(
    frames,
    data,
    modules,
    adjustment=None,
):
    modules_by_debug_id = None
    rv = []
    adjustment = adjustment or "auto"

    for frame in reversed(frames):
        if not _handles_frame(data, frame):
            continue
        s_frame = dict(frame)

        if adjustment == "none":
            s_frame["adjust_instruction_addr"] = False

        # validate and expand addressing modes.  If we can't validate and
        # expand it, we keep None which is absolute.  That's not great but
        # at least won't do damage.
        addr_mode = s_frame.pop("addr_mode", None)
        sanitized_addr_mode = None

        # None and abs mean absolute addressing explicitly.
        if addr_mode in (None, "abs"):
            pass
        # this is relative addressing to module by index or debug id.
        elif addr_mode.startswith("rel:"):
            arg = addr_mode[4:]
            idx = None

            if modules_by_debug_id is None:
                modules_by_debug_id = {x.get("debug_id"): idx for idx, x in enumerate(modules)}
            try:
                idx = modules_by_debug_id.get(normalize_debug_id(arg))
            except ParseDebugIdError:
                pass

            if idx is None and arg.isdigit():
                idx = int(arg)

            if idx is not None:
                sanitized_addr_mode = "rel:%d" % idx

        if sanitized_addr_mode is not None:
            s_frame["addr_mode"] = sanitized_addr_mode
        rv.append(s_frame)

    if len(rv) > 0:
        first_frame = rv[0]
        if adjustment == "all":
            first_frame["adjust_instruction_addr"] = True
        elif adjustment == "all_but_first":
            first_frame["adjust_instruction_addr"] = False

    return rv


def process_native_stacktraces(symbolicator: Symbolicator, data: Any) -> Any:
    stacktrace_infos = [
        stacktrace
        for stacktrace in find_stacktraces_in_data(data)
        if any(is_native_platform(x) for x in stacktrace.platforms)
    ]

    modules = native_images_from_data(data)

    stacktraces = [
        {
            "registers": sinfo.stacktrace.get("registers") or {},
            "frames": get_frames_for_symbolication(
                sinfo.stacktrace.get("frames") or (),
                data,
                modules,
                sinfo.stacktrace.get("instruction_addr_adjustment"),
            ),
        }
        for sinfo in stacktrace_infos
    ]

    if not any(stacktrace["frames"] for stacktrace in stacktraces):
        return

    signal = signal_from_data(data)

    metrics.incr("process.native.symbolicate.request")
    response = symbolicator.process_payload(
        platform=data.get("platform"), stacktraces=stacktraces, modules=modules, signal=signal
    )

    if not _handle_response_status(data, response):
        return data

    # Emit Apple symbol stats
    apple_symbol_stats = response.get("apple_symbol_stats")
    if apple_symbol_stats:
        try:
            emit_apple_symbol_stats(apple_symbol_stats, data)
        except Exception as e:
            sentry_sdk.capture_exception(e)

    assert len(modules) == len(response["modules"]), (modules, response)

    os = get_os_from_event(data)

    for raw_image, complete_image in zip(modules, response["modules"]):
        _merge_image(raw_image, complete_image, os, data)

    assert len(stacktraces) == len(response["stacktraces"]), (stacktraces, response)

    for sinfo, complete_stacktrace in zip(stacktrace_infos, response["stacktraces"]):
        complete_frames_by_idx: dict[int, list[dict[str, Any]]] = {}
        for complete_frame in complete_stacktrace.get("frames") or ():
            complete_frames_by_idx.setdefault(complete_frame["original_index"], []).append(
                complete_frame
            )

        new_frames = []
        native_frames_idx = 0

        for raw_frame in reversed(sinfo.stacktrace["frames"]):
            if not _handles_frame(data, raw_frame):
                new_frames.append(raw_frame)
                continue

            for complete_frame in complete_frames_by_idx.get(native_frames_idx) or ():
                merged_frame = dict(raw_frame)
                platform = merged_frame.get("platform") or data.get("platform") or "native"
                _merge_frame(merged_frame, complete_frame, platform)
                if merged_frame.get("package"):
                    raw_frame["package"] = merged_frame["package"]
                new_frames.append(merged_frame)

            native_frames_idx += 1

        if sinfo.container is not None and native_frames_idx > 0:
            sinfo.container["raw_stacktrace"] = {
                "frames": list(sinfo.stacktrace["frames"]),
                "registers": sinfo.stacktrace.get("registers"),
            }

        new_frames.reverse()
        sinfo.stacktrace["frames"] = new_frames

    return data


def emit_apple_symbol_stats(apple_symbol_stats, data):
    os_name = get_path(data, "contexts", "os", "name") or get_path(
        data, "contexts", "os", "raw_description"
    )
    os_version = get_path(data, "contexts", "os", "version")
    # See https://develop.sentry.dev/sdk/data-model/event-payloads/contexts/
    is_simulator = get_path(data, "contexts", "device", "simulator", default=False)

    if os_version:
        os_version = os_version.split(".", 1)[0]

    if neither := apple_symbol_stats.get("neither"):
        metrics.incr(
            "apple_symbol_availability_v2",
            amount=neither,
            tags={
                "availability": "neither",
                "os_name": os_name,
                "os_version": os_version,
                "is_simulator": is_simulator,
            },
            sample_rate=1.0,
        )

    if both := apple_symbol_stats.get("both"):
        metrics.incr(
            "apple_symbol_availability_v2",
            amount=both,
            tags={
                "availability": "both",
                "os_name": os_name,
                "os_version": os_version,
                "is_simulator": is_simulator,
            },
            sample_rate=1.0,
        )

    if old := apple_symbol_stats.get("old"):
        metrics.incr(
            "apple_symbol_availability_v2",
            amount=len(old),
            tags={
                "availability": "old",
                "os_name": os_name,
                "os_version": os_version,
                "is_simulator": is_simulator,
            },
            sample_rate=1.0,
        )

        # This is done to temporally collect information about the events for which symx is not working correctly.
        if in_random_rollout("symbolicate.symx-logging-rate") and os_name and os_version:
            os_description = os_name + str(os_version)
            if os_description in options.get("symbolicate.symx-os-description-list"):
                with sentry_sdk.isolation_scope() as scope:
                    scope.set_tag("os", os_description)
                    scope.set_context(
                        "Event Info",
                        {
                            "project": data.get("project"),
                            "id": data.get("event_id"),
                            "modules": old,
                            "os": os_description,
                        },
                    )
                    sentry_sdk.capture_message("Failed to find symbols using symx")

    if symx := apple_symbol_stats.get("symx"):
        metrics.incr(
            "apple_symbol_availability_v2",
            amount=symx,
            tags={
                "availability": "symx",
                "os_name": os_name,
                "os_version": os_version,
                "is_simulator": is_simulator,
            },
            sample_rate=1.0,
        )


def get_native_symbolication_function(
    data: Mapping[str, Any], stacktraces: list[StacktraceInfo]
) -> Callable[[Symbolicator, Any], Any] | None:
    """
    Returns the appropriate symbolication function (or `None`) that will process
    the event, based on the Event `data`, and the supplied `stacktraces`.
    """
    if is_minidump_event(data):
        return process_minidump
    elif is_applecrashreport_event(data):
        return process_applecrashreport
    elif is_native_event(data, stacktraces):
        return process_native_stacktraces
    else:
        return None


def get_required_attachment_types(data) -> set[str]:
    if is_minidump_event(data):
        return {MINIDUMP_ATTACHMENT_TYPE}
    elif is_applecrashreport_event(data):
        return {APPLECRASHREPORT_ATTACHMENT_TYPE}
    else:
        return set()
