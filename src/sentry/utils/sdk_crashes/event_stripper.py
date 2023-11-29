from enum import Enum, auto
from typing import Any, Dict, Mapping, MutableMapping, Optional, Sequence

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
                    "filename": Allow.SIMPLE_TYPE.with_explanation(
                        "We overwrite the filename for SDK frames and it's acceptable to keep it for system library frames."
                    ),
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
            "simulator": Allow.SIMPLE_TYPE,
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
    """
    This method keeps only properties based on the ALLOW_LIST. For frames, both the allow list applies,
    and the method only keeps SDK frames and system library frames.
    """

    frames = get_path(event_data, "exception", "values", -1, "stacktrace", "frames")
    if not frames:
        return {}

    # We strip the frames first because applying the allowlist removes fields that are needed
    # for deciding wether to keep a frame or not.
    stripped_frames = _strip_frames(frames, sdk_crash_detector)

    event_data_copy = dict(event_data)
    event_data_copy["exception"]["values"][0]["stacktrace"]["frames"] = stripped_frames

    stripped_event_data = _strip_event_data_with_allowlist(event_data_copy, EVENT_DATA_ALLOWLIST)

    if not stripped_event_data:
        return {}

    return stripped_event_data


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
    frames: Sequence[MutableMapping[str, Any]], sdk_crash_detector: SDKCrashDetector
) -> Sequence[Mapping[str, Any]]:
    """
    Only keep SDK and system libraries frames.

    This method sets in_app to True for SDK frames for grouping. The grouping config
    will set in_app false for all SDK frames. To not change the grouping logic, we must
    add a stacktrace rule for each path configured in
    `SDKCrashDetectorConfig.sdk_frame_config.path_replacer` and
    `SDKCrashDetectorConfig.sdk_frame_path_default_replacement_name`.

    For example, Cocoa only uses `Sentry.framework` as a replacement path, so we must add the rule `stack.abs_path:Sentry.framework +app +group` to it's project in Sentry.
    """

    def strip_frame(frame: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        if sdk_crash_detector.is_sdk_frame(frame):
            frame["in_app"] = True

            # The path field usually contains the name of the application, which we can't keep.
            for path_field_key in sdk_crash_detector.fields_containing_paths:
                path_field_value: str = frame.get(path_field_key, "")
                if path_field_value:
                    frame[path_field_key] = sdk_crash_detector.replace_sdk_frame_path(
                        path_field_value
                    )
        else:
            frame["in_app"] = False

        return frame

    return [
        strip_frame(frame)
        for frame in frames
        if sdk_crash_detector.is_sdk_frame(frame)
        or sdk_crash_detector.is_system_library_frame(frame)
    ]
