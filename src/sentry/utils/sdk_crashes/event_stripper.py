from typing import Any, Mapping, Sequence

from sentry.eventstore.models import Event
from sentry.utils.safe import get_path
from sentry.utils.sdk_crashes.sdk_crash_detector import SDKCrashDetector


class EventStripper:
    def __init__(
        self,
        sdk_crash_detector: SDKCrashDetector,
    ):
        self
        self.sdk_crash_detector = sdk_crash_detector

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

    def strip_event_data(self, event: Event) -> Event:
        new_event = dict(filter(self._filter_event, event.items()))
        new_event["contexts"] = dict(filter(self._filter_contexts, new_event["contexts"].items()))

        stripped_frames = []
        frames = get_path(event, "exception", "values", -1, "stacktrace", "frames")

        if frames is not None:
            stripped_frames = self._strip_frames(frames)
            new_event["exception"]["values"][0]["stacktrace"]["frames"] = stripped_frames

        debug_meta_images = get_path(event, "debug_meta", "images")
        if debug_meta_images is not None:
            stripped_debug_meta_images = self._strip_debug_meta(debug_meta_images, stripped_frames)
            new_event["debug_meta"]["images"] = stripped_debug_meta_images

        return new_event

    def _filter_event(self, pair):
        key, _ = pair
        if key in self.ALLOWED_EVENT_KEYS:
            return True

        return False

    def _filter_contexts(self, pair):
        key, _ = pair
        if key in {"os", "device"}:
            return True
        return False

    def _strip_debug_meta(
        self, debug_meta_images: Sequence[Mapping[str, Any]], frames: Sequence[Mapping[str, Any]]
    ) -> Sequence[Mapping[str, Any]]:

        frame_image_addresses = {frame["image_addr"] for frame in frames}

        return [
            image for image in debug_meta_images if image["image_addr"] in frame_image_addresses
        ]

    def _strip_frames(self, frames: Sequence[Mapping[str, Any]]) -> Sequence[Mapping[str, Any]]:
        """
        Only keep SDK frames or non in app frames.
        """
        return [
            frame
            for frame in frames
            if self.sdk_crash_detector.is_sdk_frame(frame) or frame.get("in_app", True) is False
        ]
