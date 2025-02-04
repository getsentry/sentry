import logging
from collections.abc import Mapping
from typing import Any

from sentry.db.models.fields.node import NodeData
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


def identify_stacktrace_paths(data: NodeData) -> list[str]:
    """
    Get the stacktrace_paths from the event data.
    """
    stacktraces = get_stacktrace(data)
    stacktrace_paths = set()
    for stacktrace in stacktraces:
        try:
            frames = stacktrace["frames"]
            paths = {
                frame["filename"]
                for frame in frames
                if frame and frame.get("in_app") and frame.get("filename")
            }
            stacktrace_paths.update(paths)
        except Exception:
            logger.exception("Error getting filenames for project.")
    return list(stacktrace_paths)


def get_stacktrace(data: NodeData) -> list[Mapping[str, Any]]:
    exceptions = get_path(data, "exception", "values", filter=True)
    if exceptions:
        return [e["stacktrace"] for e in exceptions if get_path(e, "stacktrace", "frames")]

    stacktrace = data.get("stacktrace")
    if stacktrace and stacktrace.get("frames"):
        return [stacktrace]

    return []
