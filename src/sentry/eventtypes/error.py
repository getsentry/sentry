from __future__ import annotations

from collections.abc import MutableMapping
from typing import Any

from sentry import options
from sentry.utils.safe import get_path, trim
from sentry.utils.strings import truncatechars

from .base import BaseEvent

Metadata = dict[str, Any]


def get_crash_location(data: MutableMapping[str, Any]) -> tuple[str | None, str | None] | None:
    """If available, return the frame and function of the crash location."""
    from sentry.stacktraces.processing import get_crash_frame_from_event_data

    frame = get_crash_frame_from_event_data(
        data, frame_filter=lambda x: x.get("function") not in (None, "<redacted>", "<unknown>")
    )
    if frame is not None:
        from sentry.stacktraces.functions import get_function_name_for_frame

        func = get_function_name_for_frame(frame, data.get("platform"))
        return frame.get("filename") or frame.get("abs_path"), func
    return None


NATIVE_MOBILE_PLATFORMS = (
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
)


class ErrorEvent(BaseEvent):
    key = "error"

    def extract_metadata(self, data: MutableMapping[str, Any]) -> Metadata:
        """Extracts the metadata from the event data."""
        exception = _find_main_exception(data)
        if not exception:
            return {}
        rv = {"value": trim(get_path(exception, "value", default=""), 1024)}

        # If the exception mechanism indicates a synthetic exception we do not
        # want to record the type and value into the metadata.
        if not get_path(exception, "mechanism", "synthetic"):
            rv["type"] = trim(get_path(exception, "type", default="Error"), 128)

        # Attach crash location if available
        loc = get_crash_location(data)
        if loc is not None:
            fn, func = loc
            if fn:
                rv["filename"] = fn
            if func:
                rv["function"] = func

        return rv

    def compute_title(self, metadata: Metadata) -> str:
        title = metadata.get("type")
        if title is not None:
            value = metadata.get("value")
            if options.get("sentry.save-event.title-char-limit-256.enabled"):
                truncate_to = 256
            else:
                truncate_to = 100
            if value:
                title += f": {truncatechars(value.splitlines()[0], truncate_to)}"

        return title or metadata.get("function") or "<unknown>"

    def get_location(self, metadata: Metadata) -> str | None:
        return metadata.get("filename")


def _find_main_exception(data: MutableMapping[str, Any]) -> str | None:
    exceptions = get_path(data, "exception", "values")
    if not exceptions:
        return None

    # With chained exceptions, the SDK or our grouping logic can set the main_exception_id
    # to indicate which exception to use for title & subtitle
    main_exception_id = get_path(data, "main_exception_id")
    return get_exception(exceptions, main_exception_id)


def get_exception(exceptions: MutableMapping[str, Any], main_exception_id: str) -> str | None:
    """Returns the exception from the event data."""
    # When there are multiple exceptions, we need to pick one to extract the metadata from.
    # If the event data has been marked with a main_exception_id, then we should be able to
    # find the exception with the matching metadata.exception_id and use that one.
    # This can be the case for some exception groups.

    # Otherwise, the default behavior is to use the last one in the list.
    exception = (
        next(
            exception
            for exception in exceptions
            if get_path(exception, "mechanism", "exception_id") == main_exception_id
        )
        if main_exception_id
        else None
    )

    if not exception:
        exception = get_path(exceptions, -1)

    return exception
