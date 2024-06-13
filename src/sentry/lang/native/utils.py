import logging
import re
from collections.abc import Mapping
from typing import Any

from sentry.attachments import attachment_cache
from sentry.stacktraces.processing import StacktraceInfo
from sentry.utils.cache import cache_key_for_event
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

# Regex to guess whether we're dealing with Windows or Unix paths.
WINDOWS_PATH_RE = re.compile(r"^([a-z]:\\|\\\\)", re.IGNORECASE)

# Event platforms that could contain native stacktraces
# "csharp" events are also considered "native" as they are processed by symbolicator.
# This includes il2cpp events that are symbolicated using native debug files,
# as well as .NET with Portable PDB files which are handled by symbolicator.
NATIVE_PLATFORMS = ("objc", "cocoa", "swift", "native", "c", "csharp")

# Debug image types that can be handled by the symbolicator
NATIVE_IMAGE_TYPES = (
    "apple",  # Deprecated in favor of "macho"
    "symbolic",  # Generic if type is not known
    "elf",  # Linux
    "macho",  # macOS, iOS
    "pe",  # Windows
    "pe_dotnet",  # Portable PDB
    "wasm",  # WASM
)

# Default disables storing crash reports.
STORE_CRASH_REPORTS_DEFAULT = 0
# Do not limit crash report attachments per issue.
STORE_CRASH_REPORTS_ALL = -1
# The maximum number of crash report attachments per issue if not unlimited.
STORE_CRASH_REPORTS_MAX = 100


def is_native_platform(platform):
    return platform in NATIVE_PLATFORMS


def is_native_image(image):
    return (
        bool(image)
        and image.get("type") in NATIVE_IMAGE_TYPES
        and (image.get("debug_id") or image.get("id") or image.get("uuid")) is not None
    )


def native_images_from_data(data):
    return get_path(data, "debug_meta", "images", default=(), filter=is_native_image)


def is_native_event(data: Mapping[str, Any], stacktraces: list[StacktraceInfo]) -> bool:
    """Returns whether `data` is a native event, based on its platform and
    the supplied stacktraces."""

    if is_native_platform(data.get("platform")):
        return True

    for stacktrace in stacktraces:
        if any(is_native_platform(x) for x in stacktrace.platforms):
            return True

    return False


def image_name(pkg):
    if not pkg:
        return pkg
    split = "\\" if WINDOWS_PATH_RE.match(pkg) else "/"
    return pkg.rsplit(split, 1)[-1]


def get_os_from_event(event) -> str | None:
    """
    Gets the OS name from either the OS context, or the SDK Info, which represents
    the runtime SDK and *NOT* the Sentry SDK.
    """
    os = get_path(event, "contexts", "os")
    if os and os.get("type") == "os":
        if (os_name := os.get("name")) is not None:
            return os_name.lower()

    sdk_info = get_path(event, "debug_meta", "sdk_info")
    if sdk_info:
        if (sdk_name := sdk_info.get("sdk_name")) is not None:
            return sdk_name.lower()

    return None


def signal_from_data(data):
    exceptions = get_path(data, "exception", "values", filter=True)
    signal = get_path(exceptions, 0, "mechanism", "meta", "signal", "number")
    if signal is not None:
        return int(signal)

    return None


def get_event_attachment(data, attachment_type):
    cache_key = cache_key_for_event(data)
    attachments = attachment_cache.get(cache_key)
    return next((a for a in attachments if a.type == attachment_type), None)


def convert_crashreport_count(value, allow_none=False) -> int | None:
    """
    Shim to read both legacy and new `sentry:store_crash_reports` project and
    organization options.

    The legacy format stored `True` for an unlimited number of crash reports,
    and `False` for no crash reports.

    The new format stores `-1` for unbounded storage, `0` for no crash reports,
    and a positive number for a bounded number per group, and `None` for no
    setting (usually inheriting the parent setting).

    The default depends on the `allow_none` flag:
     - If unset, the default is `0` (no storage).
     - If set, the default is `None` (inherit/no value).
    """
    if value is True:
        return STORE_CRASH_REPORTS_ALL
    if value is None:
        return None if allow_none else STORE_CRASH_REPORTS_DEFAULT
    return int(value)


def is_minidump_event(data):
    """
    Checks whether an event indicates that it has an associated minidump.

    This requires the event to have a special marker payload. It is written by
    ``write_minidump_placeholder``.
    """
    exceptions = get_path(data, "exception", "values", filter=True)
    return get_path(exceptions, 0, "mechanism", "type") == "minidump"


def is_applecrashreport_event(data):
    """
    Checks whether an event indicates that it has an apple crash report.

    This requires the event to have a special marker payload. It is written by
    ``write_applecrashreport_placeholder``.
    """
    exceptions = get_path(data, "exception", "values", filter=True)
    return get_path(exceptions, 0, "mechanism", "type") == "applecrashreport"
