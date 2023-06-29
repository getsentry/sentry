from enum import Enum, auto
from typing import Any, Dict, Mapping, Optional, Sequence

from sentry.db.models import NodeData
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


class Allow(Enum):
    def __init__(self, explanation: str = "") -> None:
        self.explanation = explanation

    """Keeps the event data if it is of type str, int, float, bool."""
    SIMPLE_TYPE = auto()

    """
    Doesn't keep the event data no matter the type. This can be used to explicitly
    specify that data should be removed with an explanation.
    """
    NEVER = auto()

    def with_explanation(self, explanation: str) -> "Allow":
        self.explanation = explanation
        return self


EVENT_DATA_ALLOWLIST = {
    "type": Allow.SIMPLE_TYPE,
    "datetime": Allow.SIMPLE_TYPE,
    "timestamp": Allow.SIMPLE_TYPE,
    "platform": Allow.SIMPLE_TYPE,
    "sdk": {
        "name": Allow.SIMPLE_TYPE,
        "version": Allow.SIMPLE_TYPE,
        "integrations": Allow.NEVER.with_explanation("Users can add their own integrations."),
    },
    "exception": {
        "values": {
            "stacktrace": {
                "frames": {
                    "filename": Allow.SIMPLE_TYPE,
                    "function": Allow.SIMPLE_TYPE,
                    "raw_function": Allow.SIMPLE_TYPE,
                    "module": Allow.SIMPLE_TYPE,
                    "abs_path": Allow.SIMPLE_TYPE,
                    "in_app": Allow.SIMPLE_TYPE,
                    "instruction_addr": Allow.SIMPLE_TYPE,
                    "addr_mode": Allow.SIMPLE_TYPE,
                    "symbol": Allow.SIMPLE_TYPE,
                    "symbol_addr": Allow.SIMPLE_TYPE,
                    "image_addr": Allow.SIMPLE_TYPE,
                    "package": Allow.SIMPLE_TYPE,
                    "platform": Allow.SIMPLE_TYPE,
                }
            },
            "value": Allow.NEVER.with_explanation("The exception value could contain PII."),
            "type": Allow.SIMPLE_TYPE,
            "mechanism": {
                "handled": Allow.SIMPLE_TYPE,
                "type": Allow.SIMPLE_TYPE,
                "meta": {
                    "signal": {
                        "number": Allow.SIMPLE_TYPE,
                        "code": Allow.SIMPLE_TYPE,
                        "name": Allow.SIMPLE_TYPE,
                        "code_name": Allow.SIMPLE_TYPE,
                    },
                    "mach_exception": {
                        "exception": Allow.SIMPLE_TYPE,
                        "code": Allow.SIMPLE_TYPE,
                        "subcode": Allow.SIMPLE_TYPE,
                        "name": Allow.SIMPLE_TYPE,
                    },
                },
            },
        }
    },
    "contexts": {
        "device": {
            "family": Allow.SIMPLE_TYPE,
            "model": Allow.SIMPLE_TYPE,
            "arch": Allow.SIMPLE_TYPE,
        },
        "os": {
            "name": Allow.SIMPLE_TYPE,
            "version": Allow.SIMPLE_TYPE,
            "build": Allow.SIMPLE_TYPE,
        },
    },
}


def strip_event_data(
    event_data: NodeData, sdk_crash_detector: SDKCrashDetector
) -> Mapping[str, Any]:
    new_event_data = _strip_event_data_with_allowlist(event_data, EVENT_DATA_ALLOWLIST)

    if (new_event_data is None) or (new_event_data == {}):
        return {}

    stripped_frames: Sequence[Mapping[str, Any]] = []
    frames = get_path(new_event_data, "exception", "values", -1, "stacktrace", "frames")

    if frames is not None:
        stripped_frames = _strip_frames(frames, sdk_crash_detector)
        new_event_data["exception"]["values"][0]["stacktrace"]["frames"] = stripped_frames

    return new_event_data


def _strip_event_data_with_allowlist(
    data: Mapping[str, Any], allowlist: Optional[Mapping[str, Any]]
) -> Optional[Mapping[str, Any]]:
    """
    Recursively traverses the data and only keeps values based on the allowlist.
    """
    if allowlist is None:
        return None

    stripped_data: Dict[str, Any] = {}
    for data_key, data_value in data.items():
        allowlist_for_data = allowlist.get(data_key)
        if allowlist_for_data is None:
            continue

        if isinstance(allowlist_for_data, Allow):
            allowed = allowlist_for_data

            if allowed is Allow.SIMPLE_TYPE and isinstance(data_value, (str, int, float, bool)):
                stripped_data[data_key] = data_value
            else:
                continue

        elif isinstance(data_value, Mapping):
            stripped_data[data_key] = _strip_event_data_with_allowlist(
                data_value, allowlist_for_data
            )
        elif isinstance(data_value, Sequence):
            stripped_data[data_key] = [
                _strip_event_data_with_allowlist(item, allowlist_for_data) for item in data_value
            ]

    return stripped_data


def _strip_frames(
    frames: Sequence[Mapping[str, Any]], sdk_crash_detector: SDKCrashDetector
) -> Sequence[Mapping[str, Any]]:
    """
    Only keep SDK frames or non in app frames.
    """
    return [
        frame
        for frame in frames
        if sdk_crash_detector.is_sdk_frame(frame) or frame.get("in_app", None) is False
    ]
