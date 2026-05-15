import logging
import re
import time
from collections.abc import Mapping
from typing import Any, overload

from sentry.attachments import CachedAttachment, get_attachments_for_event
from sentry.stacktraces.processing import StacktraceInfo
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


def get_event_attachment(data: Any, attachment_type: str) -> CachedAttachment | None:
    attachments = get_attachments_for_event(data)
    return next((a for a in attachments if a.type == attachment_type), None)


@overload
def convert_crashreport_count(value: bool | None) -> int: ...


@overload
def convert_crashreport_count(value: bool | None, *, allow_none: bool) -> int | None: ...


def convert_crashreport_count(value: bool | None, allow_none: bool = False) -> int | None:
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


def find_gpu_crash_dump_attachment(data: Any) -> Any:
    """Return the GPU crash dump attachment for this event, or None.

    Matches in priority order:
      1. an attachment with the canonical type `event.nv_gpudmp`
      2. a generic `event.attachment` whose filename ends in `.nv-gpudmp`

    The second path exists because Relay versions without an `NvGpuDump`
    variant in their `AttachmentType` enum downgrade unknown types to
    `event.attachment` when `accept_unknown_items` is set. Matching by
    filename keeps the flow working end-to-end until Relay lands native
    support for the type.
    """
    from sentry.lang.native.processing import GPU_CRASH_DUMP_ATTACHMENT_TYPE

    canonical = get_event_attachment(data, GPU_CRASH_DUMP_ATTACHMENT_TYPE)
    if canonical is not None:
        return canonical

    for attachment in get_attachments_for_event(data):
        if attachment.type != "event.attachment":
            continue
        name = getattr(attachment, "name", None) or ""
        if name.endswith(".nv-gpudmp"):
            return attachment
    return None


def has_gpu_crash_dump_attachment(data: Any) -> bool:
    """True iff the event carries a GPU crash dump attachment (e.g. .nv-gpudmp).

    The attachment itself is the signal — no SDK-set mechanism marker required.
    """
    return find_gpu_crash_dump_attachment(data) is not None


# Shader debug info attachments accompany the `.nv-gpudmp`. Customer SDKs
# (the Unreal Aftermath integration in particular) call this `.nvdbg` and
# name each file by its `shader_debug_info_uid` — a 32-char hex
# identifier Aftermath itself uses to look the bytes back up via
# `shaderDebugInfoLookupCb` at decode time. We pass each one through to
# teapot via the multipart field `nv_shader_debug.<uid>` or — when the
# attachment is in objectstore — a per-entry storage_url/storage_token
# pair inside the JSON body.
SHADER_DEBUG_INFO_ATTACHMENT_TYPE = "event.nv_shader_debug"

_NVDBG_FILENAME_RE = re.compile(
    # Accept either:
    #   - `<uid>.nvdbg`             (terse form some integrations use)
    #   - `shader-<hash>-<uid>.nvdbg` (Aftermath sample / nv-tools form)
    # We pull the LAST 32-hex run before the `.nvdbg` suffix. Anything
    # that doesn't match either shape is logged + skipped — better to
    # drop one shader than to feed teapot bytes with no valid uid key.
    r"(?P<uid>[0-9a-fA-F]{32})\.nvdbg$"
)


def find_all_shader_debug_attachments(data: Any) -> list[tuple[str, CachedAttachment]]:
    """Return every shader-debug-info attachment on the event, keyed by uid.

    Each entry is `(shader_debug_info_uid, attachment)`. Uids are extracted
    from the attachment filename — Aftermath fires `OnShaderDebugInfo`
    once per shader involved in a crash and customer SDKs save each
    `.nvdbg` to disk named by its uid. We accept either the canonical
    `event.nv_shader_debug` attachment_type or a generic
    `event.attachment` whose name matches `<uid>.nvdbg` (same fallback
    pattern we use for `event.nv_gpudmp` until Relay grows native
    support for the new type).

    Skips attachments with no parseable uid; a one-off attachment lacking
    a uid is useless to teapot (Aftermath's `shaderDebugInfoLookupCb`
    keys on the uid, not on the bytes).
    """
    out: list[tuple[str, CachedAttachment]] = []
    seen_uids: set[str] = set()
    for attachment in get_attachments_for_event(data):
        # Prefer the explicit attachment_type. Same dual-path fallback as
        # find_gpu_crash_dump_attachment: until Relay knows the new type,
        # SDKs can ship them as `event.attachment` and we still pick
        # them up by filename.
        ty = getattr(attachment, "type", "") or ""
        name = getattr(attachment, "name", None) or ""
        if ty != SHADER_DEBUG_INFO_ATTACHMENT_TYPE and not (
            ty == "event.attachment" and name.endswith(".nvdbg")
        ):
            continue
        m = _NVDBG_FILENAME_RE.search(name)
        if m is None:
            logger.info(
                "gpu.shader_debug.unparseable_name",
                extra={"filename": name, "type": ty},
            )
            continue
        uid = m.group("uid").lower()
        if uid in seen_uids:
            continue
        seen_uids.add(uid)
        out.append((uid, attachment))
    return out


class Backoff:
    """
    Creates a new exponential backoff.
    """

    def __init__(self, initial, max):
        """
        :param initial: The initial backoff time in seconds.
        :param max: The maximum backoff time in seconds.
        """
        self.initial = initial
        self.max = max
        self._current = 0

    def reset(self):
        """
        Resets the backoff time zero.
        """
        self._current = 0

    def sleep_failure(self):
        """
        Sleeps until the next retry attempt and increases the backoff time for the next failure.
        """
        if self._current > 0:
            time.sleep(self._current)
        self._current = min(max(self._current * 2, self.initial), self.max)
