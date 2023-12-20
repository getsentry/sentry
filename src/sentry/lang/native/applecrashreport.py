import posixpath
from typing import List, Mapping, Optional, Tuple

from symbolic.common import parse_addr

from sentry.constants import NATIVE_UNKNOWN_STRING
from sentry.interfaces.exception import upgrade_legacy_mechanism
from sentry.lang.native.registers import (
    REGISTERS_ARM,
    REGISTERS_ARM64,
    REGISTERS_X86,
    REGISTERS_X86_64,
)
from sentry.lang.native.utils import image_name
from sentry.utils.safe import get_path

REPORT_VERSION = "104"


class AppleCrashReport:
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
        rv.append(self._get_crashed_thread_registers())
        rv.append(self.get_binary_images_apple_string())
        return "\n\n".join(rv) + "\n\nEOF"

    def _get_meta_header(self):
        return "OS Version: {} {} ({})\nReport Version: {}".format(
            get_path(self.context, "os", "name"),
            get_path(self.context, "os", "version"),
            get_path(self.context, "os", "build"),
            REPORT_VERSION,
        )

    def _get_register_index(self, register: str, register_map: Mapping[str, int]) -> int:
        return register_map.get(register[1:] if register.startswith("$") else register, -1)

    def _get_sorted_registers(
        self, registers: Mapping[str, Optional[str]], register_map: Mapping[str, int]
    ) -> List[Tuple[str, Optional[str]]]:
        return [
            (register_name, registers.get(register_name))
            for register_name in sorted(
                registers.keys(), key=lambda name: self._get_register_index(name, register_map)
            )
        ]

    def _get_register_map_for_arch(self) -> Tuple[str, bool, Mapping[str, int]]:
        arch = get_path(self.context, "device", "arch")

        if not isinstance(arch, str):
            return (NATIVE_UNKNOWN_STRING, False, {})

        if arch.startswith("x86_64"):
            return ("x86", True, REGISTERS_X86_64)
        if arch.startswith("x86"):
            return ("x86", False, REGISTERS_X86)
        if arch.startswith("arm64"):
            return ("ARM", True, REGISTERS_ARM64)
        if arch.startswith("arm"):
            return ("ARM", False, REGISTERS_ARM)
        return (arch, False, {})

    def _get_padded_hex_value(self, value: str) -> str:
        try:
            num_value = int(value, 16)
            padded_hex_value = f"{num_value:x}".rjust(16, "0")
            return "0x" + padded_hex_value
        except Exception:
            return value

    def _get_crashed_thread_registers(self):
        rv = []
        exception = get_path(self.exceptions, 0)
        if not exception:
            return ""

        thread_id = exception.get("thread_id")
        crashed_thread_info = next(
            filter(lambda t: t.get("id") == thread_id, self.threads or []), None
        )
        crashed_thread_registers = get_path(crashed_thread_info, "stacktrace", "registers")

        if not isinstance(crashed_thread_registers, Mapping):
            return ""

        arch_label, is_64_bit, register_map = self._get_register_map_for_arch()

        rv.append(
            "Thread {} crashed with {} Thread State ({}-bit):".format(
                thread_id, arch_label, "64" if is_64_bit else "32"
            )
        )

        line = " "
        for i, register in enumerate(
            self._get_sorted_registers(crashed_thread_registers, register_map)
        ):
            if i != 0 and (i % 4 == 0):
                rv.append(line)
                line = " "

            register_name, register_value = register
            line += "{}: {}".format(
                register_name.rjust(5), self._get_padded_hex_value(register_value or "0x0")
            )

        if line != " ":
            rv.append(line)

        return "\n".join(rv)

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
                "Exception Type: {}{}".format(
                    name or "Unknown", signal and (" (%s)" % signal) or ""
                )
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
        thread_string = f"Thread {thread_id}{thread_name_string}{thread_crashed_thread}\n"
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
                file = " ({}:{})".format(
                    posixpath.basename(frame.get("filename") or NATIVE_UNKNOWN_STRING),
                    frame["lineno"],
                )
            symbol = "{}{}".format(frame.get("function") or NATIVE_UNKNOWN_STRING, file)
            if next and parse_addr(frame.get("instruction_addr")) == parse_addr(
                next.get("instruction_addr")
            ):
                symbol = "[inlined] " + symbol
        return "{}{}{}{}{}".format(
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
        # We don't need binary images on symbolicated crashreport
        if self.symbolicated or self.debug_images is None:
            return ""
        binary_images = map(
            lambda i: self._convert_debug_meta_to_binary_image_row(debug_image=i),
            sorted(
                filter(lambda i: "image_addr" in i, self.debug_images),
                key=lambda i: parse_addr(i["image_addr"]),
            ),
        )
        return "Binary Images:\n" + "\n".join(binary_images)

    def _convert_debug_meta_to_binary_image_row(self, debug_image):
        slide_value = parse_addr(debug_image.get("image_vmaddr", 0))
        image_addr = parse_addr(debug_image["image_addr"]) + slide_value
        return "{} - {} {} {}  <{}> {}".format(
            hex(image_addr),
            hex(image_addr + debug_image["image_size"] - 1),
            image_name(debug_image.get("code_file") or NATIVE_UNKNOWN_STRING),
            get_path(self.context, "device", "arch") or NATIVE_UNKNOWN_STRING,
            debug_image.get("debug_id").replace("-", "").lower(),
            debug_image.get("code_file") or NATIVE_UNKNOWN_STRING,
        )
