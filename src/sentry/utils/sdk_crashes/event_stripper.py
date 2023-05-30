from typing import Any, Mapping, Sequence

from sentry.eventstore.models import Event
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector

ALLOWED_EVENT_KEYS = {
    "type",
    "datetime",
    "timestamp",
    "platform",
    "sdk",
    "level",
    "logger",
    "exception",
    "debug_meta",
    "contexts",
}


def strip_event_data(event: Event, sdk_crash_detector: SDKCrashDetector) -> Event:
    new_event_data = dict(filter(_filter_event, event.data.items()))
    new_event_data["contexts"] = dict(filter(_filter_contexts, new_event_data["contexts"].items()))

    stripped_frames = []
    frames = get_path(new_event_data, "exception", "values", -1, "stacktrace", "frames")

    if frames is not None:
        stripped_frames = _strip_frames(frames, sdk_crash_detector)
        new_event_data["exception"]["values"][0]["stacktrace"]["frames"] = stripped_frames

    debug_meta_images = get_path(new_event_data, "debug_meta", "images")
    if debug_meta_images is not None:
        stripped_debug_meta_images = _strip_debug_meta(debug_meta_images, stripped_frames)
        new_event_data["debug_meta"]["images"] = stripped_debug_meta_images

    event.data = new_event_data
    return event


def _filter_event(pair):
    key, _ = pair
    if key in ALLOWED_EVENT_KEYS:
        return True

    return False


def _filter_contexts(pair):
    key, _ = pair
    if key in {"os", "device"}:
        return True
    return False


def _strip_debug_meta(
    debug_meta_images: Sequence[Mapping[str, Any]], frames: Sequence[Mapping[str, Any]]
) -> Sequence[Mapping[str, Any]]:

    frame_image_addresses = {frame["image_addr"] for frame in frames}

    return [image for image in debug_meta_images if image["image_addr"] in frame_image_addresses]


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
