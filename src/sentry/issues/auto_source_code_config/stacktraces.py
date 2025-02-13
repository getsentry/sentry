import logging
from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from sentry.db.models.fields.node import NodeData
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


class Stacktrace(TypedDict):
    stacktrace: Mapping[str, Sequence[Mapping[str, Any]]]


def identify_stacktrace_paths(data: NodeData | Stacktrace) -> list[str]:
    """
    Get the stacktrace_paths from the event data.
    """
    stacktraces = get_stacktrace(data)
    stacktrace_paths = set()
    for stacktrace in stacktraces:
        frames = stacktrace["frames"]
        for frame in frames:
            if frame is None:
                continue

            if frame.get("in_app") and frame.get("filename"):
                stacktrace_paths.add(frame["filename"])
    return list(stacktrace_paths)


def get_stacktrace(data: NodeData | Stacktrace) -> list[Mapping[str, Any]]:
    exceptions = get_path(data, "exception", "values", filter=True)
    if exceptions:
        return [e["stacktrace"] for e in exceptions if get_path(e, "stacktrace", "frames")]

    stacktrace = data.get("stacktrace")
    if stacktrace and stacktrace.get("frames"):
        return [stacktrace]

    return []
