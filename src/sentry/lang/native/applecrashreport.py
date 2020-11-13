from __future__ import absolute_import

import posixpath

from sentry.constants import NATIVE_UNKNOWN_STRING
from sentry.interfaces.exception import upgrade_legacy_mechanism
from sentry.lang.native.utils import image_name
from sentry.utils.compat import implements_to_string
from sentry.utils.safe import get_path

from symbolic import parse_addr
from sentry.utils.compat import map

REPORT_VERSION = "104"


@implements_to_string
class AppleCrashReport(object):
    def __init__(
        self, threads=None, context=None, debug_images=None, symbolicated=False, exceptions=None
    ):
        self.threads = threads
        self.context = context
        self.debug_images = debug_images
        self.symbolicated = symbolicated
        self.exceptions = exceptions

    def __str__(self):
        rv = []
        rv.append(self._get_meta_header())
        rv.append(self._get_exception_info())
        rv.append(self.get_threads_apple_string())
        rv.append(self.get_binary_images_apple_string())
        return "\n\n".join(rv) + "\n\nEOF"

    def _get_meta_header(self):
        return "OS Version: %s %s (%s)\nReport Version: %s" % (
            get_path(self.context, "os", "name"),
            get_path(self.context, "os", "version"),
            get_path(self.context, "os", "build"),
            REPORT_VERSION,
        )

    def _get_exception_info(self):
        rv = []

        # We only have one exception at a time
        exception = get_path(self.exceptions, 0)
        if not exception:
            return ""

        mechanism = upgrade_legacy_mechanism(exception.get("mechanism")) or {}
        mechanism_meta = get_path(mechanism, "meta", default={})

        signal = get_path(mechanism_meta, "signal", "name")
        name = get_path(mechanism_meta, "mach_exception", "name")

        if name or signal:
            rv.append(
                "Exception Type: %s%s" % (name or "Unknown", signal and (" (%s)" % signal) or "")
            )

        exc_name = get_path(mechanism_meta, "signal", "code_name")
        exc_addr = get_path(mechanism, "data", "relevant_address")
        if exc_name:
            rv.append(
                "Exception Codes: %s%s"
                % (exc_name, exc_addr is not None and (" at %s" % exc_addr) or "")
            )

        if exception.get("thread_id") is not None:
            rv.append("Crashed Thread: %s" % exception["thread_id"])

        if exception.get("value"):
            rv.append("\nApplication Specific Information:\n%s" % exception["value"])

        return "\n".join(rv)

    def get_threads_apple_string(self):
        rv = []
        exception = self.exceptions or []
        threads = self.threads or []
        for thread_info in exception + threads:
            thread_string = self.get_thread_apple_string(thread_info)
            if thread_string is not None:
                rv.append(thread_string)
        return "\n\n".join(rv)

    def get_thread_apple_string(self, thread_info):
        rv = []
        stacktrace = get_path(thread_info, "stacktrace")
        if stacktrace is None:
            return None

        if stacktrace:
            frames = get_path(stacktrace, "frames", filter=True)
            if frames:
                for i, frame in enumerate(reversed(frames)):
                    frame_string = self._convert_frame_to_apple_string(
                        frame=frame,
                        next=frames[len(frames) - i - 2] if i < len(frames) - 1 else None,
                        number=i,
                    )
                    if frame_string is not None:
                        rv.append(frame_string)

        if len(rv) == 0:
            return None  # No frames in thread, so we remove thread

        is_exception = bool(thread_info.get("mechanism"))
        thread_id = thread_info.get("id") or thread_info.get("thread_id") or "0"
        thread_name = thread_info.get("name")
        thread_name_string = " name: %s" % (thread_name) if thread_name else ""
        thread_crashed = thread_info.get("crashed") or is_exception
        thread_crashed_thread = " Crashed:" if thread_crashed else ""
        thread_string = "Thread %s%s%s\n" % (thread_id, thread_name_string, thread_crashed_thread)
        return thread_string + "\n".join(rv)

    def _convert_frame_to_apple_string(self, frame, next=None, number=0):
        if frame.get("instruction_addr") is None:
            return None
        slide_value = self._get_slide_value(frame.get("image_addr"))
        instruction_addr = slide_value + parse_addr(frame.get("instruction_addr"))
        image_addr = slide_value + parse_addr(frame.get("image_addr"))
        offset = ""
        if frame.get("image_addr") is not None and (
            not self.symbolicated
            or (frame.get("function") or NATIVE_UNKNOWN_STRING) == NATIVE_UNKNOWN_STRING
        ):
            offset = " + %s" % (
                instruction_addr - slide_value - parse_addr(frame.get("symbol_addr"))
            )
        symbol = hex(image_addr)
        if self.symbolicated:
            file = ""
            if frame.get("filename") and frame.get("lineno"):
                file = " (%s:%s)" % (
                    posixpath.basename(frame.get("filename") or NATIVE_UNKNOWN_STRING),
                    frame["lineno"],
                )
            symbol = "%s%s" % (frame.get("function") or NATIVE_UNKNOWN_STRING, file)
            if next and parse_addr(frame.get("instruction_addr")) == parse_addr(
                next.get("instruction_addr")
            ):
                symbol = "[inlined] " + symbol
        return "%s%s%s%s%s" % (
            str(number).ljust(4, " "),
            image_name(frame.get("package") or NATIVE_UNKNOWN_STRING).ljust(32, " "),
            hex(instruction_addr).ljust(20, " "),
            symbol,
            offset,
        )

    def _get_slide_value(self, image_addr):
        if self.debug_images:
            for debug_image in self.debug_images:
                if parse_addr(debug_image.get("image_addr")) == parse_addr(image_addr):
                    return parse_addr(debug_image.get("image_vmaddr", 0))
        return 0

    def get_binary_images_apple_string(self):
        # We dont need binary images on symbolicated crashreport
        if self.symbolicated or self.debug_images is None:
            return ""
        binary_images = map(
            lambda i: self._convert_debug_meta_to_binary_image_row(debug_image=i),
            sorted(self.debug_images, key=lambda i: parse_addr(i["image_addr"])),
        )
        return "Binary Images:\n" + "\n".join(binary_images)

    def _convert_debug_meta_to_binary_image_row(self, debug_image):
        slide_value = parse_addr(debug_image.get("image_vmaddr", 0))
        image_addr = parse_addr(debug_image["image_addr"]) + slide_value
        return "%s - %s %s %s  <%s> %s" % (
            hex(image_addr),
            hex(image_addr + debug_image["image_size"] - 1),
            image_name(debug_image.get("code_file") or NATIVE_UNKNOWN_STRING),
            get_path(self.context, "device", "arch") or NATIVE_UNKNOWN_STRING,
            debug_image.get("debug_id").replace("-", "").lower(),
            debug_image.get("code_file") or NATIVE_UNKNOWN_STRING,
        )
