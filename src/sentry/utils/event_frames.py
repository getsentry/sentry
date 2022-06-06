from __future__ import annotations

from copy import deepcopy
from typing import Any, Callable, Mapping, MutableMapping, Optional, Sequence, Tuple, cast

from sentry.utils.safe import PathSearchable, get_path

FrameMunger = Callable[[str, MutableMapping[str, Any]], bool]


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


PLATFORM_FRAME_MUNGER: Mapping[str, FrameMunger] = {"java": java_frame_munger}


def munged_filename_and_frames(
    platform: str, data_frames: Sequence[Mapping[str, Any]], key: str = "munged_filename"
) -> Optional[Tuple[str, Sequence[Mapping[str, Any]]]]:
    """
    Applies platform-specific frame munging for filename pathing.

    Returns the key used to insert into the frames and a deepcopy of the input data_frames with munging applied,
    otherwise returns None.
    """
    munger = PLATFORM_FRAME_MUNGER.get(platform)
    if not munger:
        return None

    copy_frames: Sequence[MutableMapping[str, Any]] = cast(
        Sequence[MutableMapping[str, Any]], deepcopy(data_frames)
    )
    frames_updated = False
    for frame in copy_frames:
        frames_updated |= munger(key, frame)
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
