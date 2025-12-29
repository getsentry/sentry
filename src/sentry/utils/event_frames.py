from __future__ import annotations

import inspect
import logging
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Protocol, cast

from sentry.utils import metrics
from sentry.utils.safe import PathSearchable, get_path

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EventFrame:
    lineno: int | None = None
    in_app: bool | None = None
    abs_path: str | None = None
    filename: str | None = None
    function: str | None = None
    package: str | None = None
    module: str | None = None

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> EventFrame:
        return cls(**{k: v for k, v in data.items() if k in inspect.signature(cls).parameters})


# mypy hack to work around callable assuing the first arg of callable is 'self'
# https://github.com/python/mypy/issues/5485
class FrameMunger(Protocol):
    def __call__(self, frame: EventFrame) -> str | None:
        pass


@dataclass(frozen=True)
class SdkFrameMunger:
    frame_munger: FrameMunger
    requires_sdk: bool = False
    supported_sdks: set[str] = field(default_factory=set)


def java_frame_munger(frame: EventFrame) -> str | None:
    stacktrace_path = None
    if not frame.module or not frame.abs_path:
        logger.warning("Module or absPath is missing", extra={"frame": frame})
        return None

    from sentry.issues.auto_source_code_config.errors import (
        DoesNotFollowJavaPackageNamingConvention,
    )
    from sentry.issues.auto_source_code_config.frame_info import get_path_from_module

    try:
        _, stacktrace_path = get_path_from_module(frame.module, frame.abs_path)
    except DoesNotFollowJavaPackageNamingConvention:
        pass
    except Exception:
        # Report but continue
        logger.exception("Investigate. Error munging java frame")

    return stacktrace_path


def cocoa_frame_munger(frame: EventFrame) -> str | None:
    if not frame.package or not frame.abs_path:
        return None

    rel_path = package_relative_path(frame.abs_path, frame.package)
    if rel_path:
        return rel_path

    logger.warning(
        "sentry.issues.frame_munging.failure",
        extra={"platform": "cocoa", "frame": frame},
    )
    return None


def flutter_frame_munger(frame: EventFrame) -> str | None:
    if not frame.abs_path:
        return None

    abs_path = str(frame.abs_path)

    if abs_path.startswith("dart:"):
        return None
    elif abs_path.startswith("package:"):
        if not frame.package:
            return None

        pkg = frame.package
        if abs_path.find(f"package:{pkg}") == -1:
            return None
        else:
            src_path = abs_path.replace(f"package:{pkg}", "", 1).strip("/")
            if src_path:
                return src_path
    return None


def package_relative_path(abs_path: str | None, package: str | None) -> str | None:
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


PLATFORM_FRAME_MUNGER: dict[str, SdkFrameMunger] = {
    "java": SdkFrameMunger(java_frame_munger),
    "cocoa": SdkFrameMunger(cocoa_frame_munger),
    "other": SdkFrameMunger(flutter_frame_munger, True, {"sentry.dart.flutter"}),
}


def get_sdk_name(event_data: PathSearchable) -> str | None:
    return get_path(event_data, "sdk", "name", filter=True) or None


def try_munge_frame_path(
    frame: EventFrame,
    platform: str | None = None,
    sdk_name: str | None = None,
) -> str | None:
    """
    Applies platform-specific frame munging for filename pathing.

    If munging was successful, return the munged filename, otherwise return None.
    """
    munger = platform and PLATFORM_FRAME_MUNGER.get(platform)
    if not munger or (munger.requires_sdk and sdk_name not in munger.supported_sdks):
        return None

    munged_filename = munger.frame_munger(frame)
    metrics.incr(
        "sentry.issues.frame_munging",
        tags={"platform": platform, "outcome": "success" if munged_filename else "failure"},
    )
    return munged_filename


def munged_filename_and_frames(
    platform: str | None,
    data_frames: Sequence[Mapping[str, Any]],
    key: str = "munged_filename",
    sdk_name: str | None = None,
) -> tuple[str, Sequence[Mapping[str, Any]]] | None:
    """
    Applies platform-specific frame munging for filename pathing.

    Returns the key used to insert into the frames and a deepcopy of the input data_frames with munging applied,
    otherwise returns None.
    """
    if platform is None:
        return None

    munger = PLATFORM_FRAME_MUNGER.get(platform)
    if not munger or (munger.requires_sdk and sdk_name not in munger.supported_sdks):
        return None

    copy_frames: Sequence[MutableMapping[str, Any]] = cast(
        Sequence[MutableMapping[str, Any]], deepcopy(data_frames)
    )
    frames_updated = False
    for frame in copy_frames:
        munged_filename = munger.frame_munger(EventFrame.from_dict(frame))
        if munged_filename:
            frame[key] = munged_filename
            frames_updated = True
    return (key, copy_frames) if frames_updated else None


def get_crashing_thread(
    thread_frames: Sequence[Mapping[str, Any]] | None,
) -> Mapping[str, Any] | None:
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
            # Handles edge case where the second call to get_path doesn't return a list of threads
            if threads == {"values": None}:
                threads = None
            thread = get_crashing_thread(threads)
            if thread is not None:
                frames = get_path(thread, "stacktrace", "frames", filter=True) or []
        for frame in frames or ():
            consume_frame(frame)

    return frames
