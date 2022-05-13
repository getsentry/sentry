from __future__ import annotations

from typing import Any, Callable, Mapping, MutableMapping, Sequence

from sentry.utils.safe import PathSearchable, get_path


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


def supplement_filename(platform: str, data_frames: Sequence[MutableMapping[str, Any]]) -> None:
    # Java stackframes don't have an absolute path in the filename key.
    # That property is usually just the basename of the file. In the future
    # the Java SDK might generate better file paths, but for now we use the module
    # path to approximate the file path so that we can intersect it with commit
    # file paths.
    if platform == "java":
        for frame in data_frames:
            if frame.get("filename") is None:
                continue
            if "/" not in str(frame.get("filename")) and frame.get("module"):
                # Replace the last module segment with the filename, as the
                # terminal element in a module path is the class
                module = frame["module"].split(".")
                module[-1] = frame["filename"]
                frame["filename"] = "/".join(module)


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
            threads = get_path(event_data, "threads", "values", filter=True)
            thread = get_crashing_thread(threads)
            if thread is not None:
                frames = get_path(thread, "stacktrace", "frames") or []
        for frame in frames or ():
            consume_frame(frame)

    return frames
