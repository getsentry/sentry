from __future__ import annotations

import logging
from typing import Any

from sentry.db.models.fields.node import NodeData
from sentry.utils.safe import get_path

from .utils import PlatformConfig

logger = logging.getLogger(__name__)


def get_frames_to_process(data: NodeData | dict[str, Any], platform: str) -> list[dict[str, Any]]:
    """It flattens all processableframes from the event's data."""
    platform_config = PlatformConfig(platform)
    stacktraces = get_stacktraces(data)
    frames_to_process = []
    for stacktrace in stacktraces:
        frames = stacktrace["frames"] or []
        for frame in frames:

            if platform_config.creates_in_app_stack_trace_rules():
                frames_to_process.append(frame)

            elif frame.get("in_app") and frame.get("filename"):
                frames_to_process.append(frame)

    return list(frames_to_process)


def get_stacktraces(data: NodeData | dict[str, Any]) -> list[dict[str, Any]]:
    exceptions = get_path(data, "exception", "values", filter=True)
    if exceptions:
        return [
            e["stacktrace"] for e in exceptions if get_path(e, "stacktrace", "frames", filter=True)
        ]

    stacktrace = get_path(data, "stacktrace", filter=True)
    return [stacktrace] if stacktrace else []
