from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import (
    Any,
    Callable,
    Mapping,
    MutableMapping,
    Optional,
    Protocol,
    Sequence,
    Set,
    Tuple,
    cast,
)

from sentry.utils.safe import PathSearchable, get_path


# mypy hack to work around callable assuing the first arg of callable is 'self'
# https://github.com/python/mypy/issues/5485
class FrameMunger(Protocol):
    def __call__(self, key: str, frame: MutableMapping[str, Any]) -> bool:
        pass


@dataclass(frozen=True)
class SdkFrameMunger:
    frame_munger: FrameMunger
    requires_sdk: bool = False
    supported_sdks: Set[str] = field(default_factory=set)


def java_frame_munger(key: str, frame: MutableMapping[str, Any]) -> bool:
    if frame.get("filename") is None or frame.get("module") is None:
        return False
    if "/" not in str(frame.get("filename")) and frame.get("module"):
        # Replace the last module segment with the filename, as the
        # terminal element in a module path is the class
        module = frame["module"].split(".")
        module[-1] = frame["filename"]
        frame[key] = "/".join(module)
        return True
    return False


def cocoa_frame_munger(key: str, frame: MutableMapping[str, Any]) -> bool:
    if not frame.get("package") or not frame.get("abs_path"):
        return False

    rel_path = package_relative_path(str(frame.get("abs_path")), str(frame.get("package")))
    if rel_path:
        frame[key] = rel_path
        return True
    return False


def flutter_frame_munger(key: str, frame: MutableMapping[str, Any]) -> bool:
    if not frame.get("abs_path"):
        return False

    abs_path = str(frame.get("abs_path"))

    if abs_path.startswith("dart:"):
        return False
    elif abs_path.startswith("package:"):
        if not frame.get("package"):
            return False

        pkg = frame.get("package")
        if abs_path.find(f"package:{pkg}") == -1:
            return False
        else:
            src_path = abs_path.replace(f"package:{pkg}", "", 1).strip("/")
            if src_path:
                frame[key] = src_path
                return True
    return False


def package_relative_path(abs_path: str, package: str) -> str | None:
    """
    returns the left-biased shortened path relative to the package directory
    """
    if not abs_path or not package:
        return None

    package = package.strip("/")
    paths = abs_path.strip("/").split("/")
    for idx, path in enumerate(paths):
        if path == package:
            return "/".join(paths[idx:])

    return None


PLATFORM_FRAME_MUNGER: Mapping[str, SdkFrameMunger] = {
    "java": SdkFrameMunger(java_frame_munger),
    "cocoa": SdkFrameMunger(cocoa_frame_munger),
    "other": SdkFrameMunger(flutter_frame_munger, True, {"sentry.dart.flutter"}),
}


def get_sdk_name(event_data: PathSearchable) -> Optional[str]:
    return get_path(event_data, "sdk", "name", filter=True) or None


def munged_filename_and_frames(
    platform: str,
    data_frames: Sequence[Mapping[str, Any]],
    key: str = "munged_filename",
    sdk_name: str | None = None,
) -> Optional[Tuple[str, Sequence[Mapping[str, Any]]]]:
    """
    Applies platform-specific frame munging for filename pathing.

    Returns the key used to insert into the frames and a deepcopy of the input data_frames with munging applied,
    otherwise returns None.
    """
    munger = PLATFORM_FRAME_MUNGER.get(platform)
    if not munger or (munger.requires_sdk and sdk_name not in munger.supported_sdks):
        return None

    copy_frames: Sequence[MutableMapping[str, Any]] = cast(
        Sequence[MutableMapping[str, Any]], deepcopy(data_frames)
    )
    frames_updated = False
    for frame in copy_frames:
        frames_updated |= munger.frame_munger(key, frame)
    return (key, copy_frames) if frames_updated else None


def get_crashing_thread(thread_frames: Sequence[Mapping[str, Any]]) -> Mapping[str, Any] | None:
    if not thread_frames:
        return None
    if len(thread_frames) == 1:
        return thread_frames[0]
    filtered = [x for x in thread_frames if x and x.get("crashed")]
    if len(filtered) == 1:
        return filtered[0]
    filtered = [x for x in thread_frames if x and x.get("current")]
    if len(filtered) == 1:
        return filtered[0]

    return None


def find_stack_frames(
    event_data: PathSearchable, consume_frame: Callable[[Any], None] = lambda _: None
) -> Sequence[Mapping[str, Any]]:
    """
    See: https://develop.sentry.dev/sdk/event-payloads/#core-interfaces for event data payload format.

    Waterfall logic for searching for stack frames in an event:
    - `exception` interface for any 'stacktrace' frames.
    - 'stacktrace' interface
    - 'threads' interface for the relevant 'crashing' thread stack frames
    """

    frames = []
    stacktrace_in_exception = False
    for exc in get_path(event_data, "exception", "values", filter=True) or ():
        for frame in get_path(exc, "stacktrace", "frames", filter=True) or ():
            consume_frame(frame)
            frames.append(frame)
            stacktrace_in_exception = True

    if not stacktrace_in_exception:
        # according to: https://develop.sentry.dev/sdk/event-payloads/stacktrace/
        # stacktrace interface shouldn't be a top-level event property, so the next statement could be useless
        # potentially here for backwards compatibility
        frames = get_path(event_data, "stacktrace", "frames", filter=True) or []
        if not frames:
            threads = get_path(event_data, "threads", "values", filter=True) or get_path(
                event_data, "threads", filter=True
            )
            thread = get_crashing_thread(threads)
            if thread is not None:
                frames = get_path(thread, "stacktrace", "frames") or []
        for frame in frames or ():
            consume_frame(frame)

    return frames
