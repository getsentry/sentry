from __future__ import annotations

import logging
from typing import TypedDict

from sentry.db.models.fields.node import NodeData
from sentry.utils.safe import get_path

from .constants import PROCESS_SYSTEM_FRAMES

logger = logging.getLogger(__name__)


class Stacktrace(TypedDict):
    frames: list[Frame]


class Frame(TypedDict):
    filename: str
    in_app: bool


def get_frames_to_process(data: NodeData | Stacktrace, platform: str | None = None) -> list[Frame]:
    """Get processable frames from the event's data."""
    stacktraces = get_stacktraces(data)
    frames_to_process = []
    for stacktrace in stacktraces:
        frames = stacktrace.frames
        for frame in frames:
            if frame is None:
                continue

            if platform in PROCESS_SYSTEM_FRAMES:
                frames_to_process.append(frame)

            elif frame.get("in_app") and frame.get("filename"):
                frames_to_process.append(frame)

    return list(frames_to_process)


def get_path_from_module(module: str, abs_path: str) -> tuple[str | None, str | None]:
    """This converts a Java module name and filename into a real path.
    e.g. com.foo.bar.Baz$handle$1, Baz.kt -> com/foo/bar/Baz.kt
    """
    new_module = None
    new_path = None
    backslash_count = module.count("\\")
    period_count = module.count(".")
    # We have a Java package name and perhaps the extension
    # sentry.io -> io.sentry.package_name.ClassName
    if backslash_count == 0 and period_count >= 3:
        # Sometimes, the module name has a dollar sign after the class name
        # so we split on the dollar sign and take the first part
        new_module = module.replace(".", "/").split("$")[0]
        if abs_path and abs_path.count(".") == 1:
            extension = abs_path.rsplit(".")[1]
            new_path = f"{new_module}.{extension}"

    return new_module, new_path


def get_stacktraces(data: NodeData | Stacktrace) -> list[Stacktrace]:
    exceptions = get_path(data, "exception", "values", filter=True)
    if exceptions:
        return [e["stacktrace"] for e in exceptions if get_path(e, "stacktrace", "frames")]

    # XXX: Is this right??
    raise Exception("Do we use this code path?")
    frames = get_path(data, "stacktrace", "frames")
    if frames:
        return frames

    return []
