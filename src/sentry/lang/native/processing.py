from __future__ import absolute_import

import logging
import posixpath
import six

from sentry.lang.native.error import write_error, SymbolicationFailed
from sentry.lang.native.symbolicator import Symbolicator
from sentry.lang.native.utils import (
    is_minidump_event,
    is_applecrashreport_event,
    get_sdk_from_event,
    native_images_from_data,
    is_native_platform,
    is_native_event,
    image_name,
    signal_from_data,
    get_event_attachment,
)
from sentry.models import Project, EventError
from sentry.utils.in_app import is_known_third_party, is_optional_package
from sentry.utils.safe import get_path, set_path, setdefault_path, trim
from sentry.stacktraces.functions import trim_function_name
from sentry.stacktraces.processing import find_stacktraces_in_data
from sentry.utils.compat import zip


logger = logging.getLogger(__name__)


IMAGE_STATUS_FIELDS = frozenset(("unwind_status", "debug_status"))

# Attachment type used for minidump files
MINIDUMP_ATTACHMENT_TYPE = "event.minidump"

# Attachment type used for Apple Crash Reports
APPLECRASHREPORT_ATTACHMENT_TYPE = "event.applecrashreport"


def _merge_frame(new_frame, symbolicated):
    if symbolicated.get("function"):
        raw_func = trim(symbolicated["function"], 256)
        func = trim(trim_function_name(symbolicated["function"], "native"), 256)

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
    if symbolicated.get("package"):
        new_frame["package"] = symbolicated["package"]
    if symbolicated.get("trust"):
        new_frame["trust"] = symbolicated["trust"]
    if symbolicated.get("pre_context"):
        new_frame["pre_context"] = symbolicated["pre_context"]
    if symbolicated.get("context_line") is not None:
        new_frame["context_line"] = symbolicated["context_line"]
    if symbolicated.get("post_context"):
        new_frame["post_context"] = symbolicated["post_context"]
    if symbolicated.get("status"):
        frame_meta = new_frame.setdefault("data", {})
        frame_meta["symbolicator_status"] = symbolicated["status"]


def _handle_image_status(status, image, sdk_info, data):
    if status in ("found", "unused"):
        return
    elif status == "missing":
        package = image.get("code_file")
        # TODO(mitsuhiko): This check seems wrong?  This call seems to
        # mirror the one in the ios symbol server support.  If we change
        # one we need to change the other.
        if not package or is_known_third_party(package, sdk_info=sdk_info):
            return

        if is_optional_package(package, sdk_info=sdk_info):
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


def _merge_image(raw_image, complete_image, sdk_info, data):
    statuses = set()

    # Set image data from symbolicator as symbolicator might know more
    # than the SDK, especially for minidumps
    for k, v in six.iteritems(complete_image):
        if k in IMAGE_STATUS_FIELDS:
            statuses.add(v)
        if not (v is None or (v == "unknown" and k in ("arch", "type"))):
            raw_image[k] = v

    for status in set(statuses):
        _handle_image_status(status, raw_image, sdk_info, data)


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
    set_path(data, "contexts", "os", "type", value="os")  # Required by "get_sdk_from_event"

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
    if response.get("crashed") is not None:
        data["level"] = "fatal" if response["crashed"] else "info"

    if response.get("system_info"):
        _merge_system_info(data, response["system_info"])

    sdk_info = get_sdk_from_event(data)

    images = []
    set_path(data, "debug_meta", "images", value=images)

    for complete_image in response["modules"]:
        image = {}
        _merge_image(image, complete_image, sdk_info, data)
        images.append(image)

    # Extract the crash reason and infos
    data_exception = get_path(data, "exception", "values", 0)
    if response.get("assertion"):
        data_exception["value"] = "Assertion Error: %s" % (response["assertion"],)
    elif response.get("crash_details"):
        data_exception["value"] = response["crash_details"]
    elif response.get("crash_reason"):
        data_exception["value"] = "Fatal Error: %s" % (response["crash_reason"],)
    else:
        # We're merging a full response, so there was no initial payload
        # submitted. Assuming that this still contains the placeholder, remove
        # it rather than showing a default value.
        data_exception.pop("value", None)

    if response.get("crash_reason"):
        data_exception["type"] = response["crash_reason"]

    data_threads = []
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

        data_thread = {"id": thread_id, "crashed": is_requesting}
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
            new_frame = {}
            _merge_frame(new_frame, complete_frame)
            data_stacktrace["frames"].append(new_frame)


def process_minidump(data):
    project = Project.objects.get_from_cache(id=data["project"])

    minidump = get_event_attachment(data, MINIDUMP_ATTACHMENT_TYPE)
    if not minidump:
        logger.error("Missing minidump for minidump event")
        return

    symbolicator = Symbolicator(project=project, event_id=data["event_id"])

    response = symbolicator.process_minidump(minidump.data)

    if _handle_response_status(data, response):
        _merge_full_response(data, response)

    return data


def process_applecrashreport(data):
    project = Project.objects.get_from_cache(id=data["project"])

    report = get_event_attachment(data, APPLECRASHREPORT_ATTACHMENT_TYPE)
    if not report:
        logger.error("Missing applecrashreport for event")
        return

    symbolicator = Symbolicator(project=project, event_id=data["event_id"])

    response = symbolicator.process_applecrashreport(report.data)

    if _handle_response_status(data, response):
        _merge_full_response(data, response)

    return data


def _handles_frame(data, frame):
    if not frame:
        return False

    if get_path(frame, "data", "symbolicator_status") is not None:
        return False

    # TODO: Consider ignoring platform
    platform = frame.get("platform") or data.get("platform")
    return is_native_platform(platform) and "instruction_addr" in frame


def process_payload(data):
    project = Project.objects.get_from_cache(id=data["project"])

    symbolicator = Symbolicator(project=project, event_id=data["event_id"])

    stacktrace_infos = [
        stacktrace
        for stacktrace in find_stacktraces_in_data(data)
        if any(is_native_platform(x) for x in stacktrace.platforms)
    ]

    stacktraces = [
        {
            "registers": sinfo.stacktrace.get("registers") or {},
            "frames": [
                f for f in reversed(sinfo.stacktrace.get("frames") or ()) if _handles_frame(data, f)
            ],
        }
        for sinfo in stacktrace_infos
    ]

    if not any(stacktrace["frames"] for stacktrace in stacktraces):
        return

    modules = native_images_from_data(data)
    signal = signal_from_data(data)

    response = symbolicator.process_payload(stacktraces=stacktraces, modules=modules, signal=signal)

    if not _handle_response_status(data, response):
        return data

    assert len(modules) == len(response["modules"]), (modules, response)

    sdk_info = get_sdk_from_event(data)

    for raw_image, complete_image in zip(modules, response["modules"]):
        _merge_image(raw_image, complete_image, sdk_info, data)

    assert len(stacktraces) == len(response["stacktraces"]), (stacktraces, response)

    for sinfo, complete_stacktrace in zip(stacktrace_infos, response["stacktraces"]):
        complete_frames_by_idx = {}
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
                _merge_frame(merged_frame, complete_frame)
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


def get_symbolication_function(data):
    if is_minidump_event(data):
        return process_minidump
    elif is_applecrashreport_event(data):
        return process_applecrashreport
    elif is_native_event(data):
        return process_payload


def should_process_with_symbolicator(data):
    return bool(get_symbolication_function(data))
