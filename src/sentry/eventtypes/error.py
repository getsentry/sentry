from typing import Optional

from sentry.utils.safe import get_path, trim
from sentry.utils.strings import truncatechars

from .base import BaseEvent, compute_title_with_tree_label


def get_crash_location(data):
    from sentry.stacktraces.processing import get_crash_frame_from_event_data

    frame = get_crash_frame_from_event_data(
        data, frame_filter=lambda x: x.get("function") not in (None, "<redacted>", "<unknown>")
    )
    if frame is not None:
        from sentry.stacktraces.functions import get_function_name_for_frame

        func = get_function_name_for_frame(frame, data.get("platform"))
        return frame.get("filename") or frame.get("abs_path"), func


class ErrorEvent(BaseEvent):
    key = "error"

    def extract_metadata(self, data):
        exception = get_path(data, "exception", "values", -1)
        if not exception:
            return {}

        loc = get_crash_location(data)
        rv = {"value": trim(get_path(exception, "value", default=""), 1024)}

        # If the exception mechanism indicates a synthetic exception we do not
        # want to record the type and value into the metadata.
        if not get_path(exception, "mechanism", "synthetic"):
            rv["type"] = trim(get_path(exception, "type", default="Error"), 128)

        # Attach crash location if available
        if loc is not None:
            fn, func = loc
            if fn:
                rv["filename"] = fn
            if func:
                rv["function"] = func

        if data.get("platform") not in (
            # For now we disable rendering of tree labels for non-native/mobile
            # platform in issuestream and everywhere else but the grouping
            # breakdown. The grouping breakdown unsets this flag to force tree
            # labels to show.
            #
            # In the frontend we look at the event platform directly when
            # rendering the title to apply this logic to old data that doesn't
            # have this flag materialized.
            "cocoa",
            "objc",
            "native",
            "swift",
            "c",
            "android",
            "apple-ios",
            "cordova",
            "capacitor",
            "javascript-cordova",
            "javascript-capacitor",
            "react-native",
            "flutter",
            "dart-flutter",
            "unity",
            "dotnet-xamarin",
        ):
            rv["hide_tree_labels"] = True

        return rv

    def compute_title(self, metadata):
        title: Optional[str] = metadata.get("type")
        if title is not None:
            value = metadata.get("value")
            if value:
                title += f": {truncatechars(value.splitlines()[0], 100)}"

        if not metadata.get("hide_tree_labels"):
            return compute_title_with_tree_label(title, metadata)

        return title or metadata.get("function") or "<unknown>"

    def get_location(self, metadata):
        return metadata.get("filename")
