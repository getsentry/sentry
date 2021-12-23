from typing import Optional

from sentry.utils.safe import get_path, trim
from sentry.utils.strings import truncatechars

from .base import BaseEvent, compute_title_with_tree_label


def get_crash_location(data):
    """
    Given a Sentry event data dictionary, return the filename and function name of the frame that represents the
    crash (if any). If there is no such crash
    location, return `None`.
    """
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
        """
        Extracts metadata from the event data.

        :param dict data: The event data dictionary.
        :return dict: A dictionary containing extracted metadata. This
        will be merged into ``data["metadata"]`` and eventually used to construct a :class:`Event`.

            - ``value`` (string): The exception value, or the
        stringified exception if no value is available (e.g., for Java exceptions). Defaults to an empty string if not present in the payload; this indicates
        that no explicit exception was thrown by a language runtime, but rather an error occurred as part of normal execution flow (e.g., due to invalid user
        input).

            - ``type`` (string): The type of the exception being thrown, e.g., "SyntaxError" or "TypeError". Defaults to an empty string if not
        present in the payload; this indicates that either no explicit exception was thrown by a language runtime or else we were unable to extract
        information about it from any source code involved in triggering this event's error condition -- usually because there is no such source code at all!
        In practice, most events fall into one of these two categories and so contain little useful metadata about their cause/triggering circumstances at
        all!
        """
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

        rv["display_title_with_tree_label"] = data.get("platform") in (
            # For now we disable rendering of tree labels for non-native/mobile
            # platform in issuestream and everywhere else but the grouping
            # breakdown. The grouping breakdown overrides this flag to force
            # tree labels to show.
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
        )

        return rv

    def compute_title(self, metadata):
        """
        Compute the title of an event.

        The title is a string that will be displayed in the UI to identify this event. It is based on the type and value
        fields of this event, but may also include information from its metadata field if it has been populated by a previous analysis pass. The following
        rules are used to compute the title:

          * If `type` is set and `value` isn't, then use only `type`.
          * If neither `type` nor `value` are set, then
        use only '<unknown>'.

          * If both are set but no metadata has been provided (or it doesn't have a 'display_title_with_tree_label' key), show just the
        types and values:

            >>> compute_title({'type': 'foo', 'value': None}) # doctest: +SKIP
            foo

            >>> compute_title({'type': None, 'value': 42})
        # doctest: +SKIP
            42

          * Otherwise if there's no tree label display option or it's True (i.e., we're not showing tree labels) show all available
        info including tree labels for display purposes (this should never happen as events with
        """
        title: Optional[str] = metadata.get("type")
        if title is not None:
            value = metadata.get("value")
            if value:
                title += f": {truncatechars(value.splitlines()[0], 100)}"

        # If there's no value for display_title_with_tree_label, or if the
        # value is None, we should show the tree labels anyway since it's an
        # old event.
        if metadata.get("display_title_with_tree_label") in (None, True):
            return compute_title_with_tree_label(title, metadata)

        return title or metadata.get("function") or "<unknown>"

    def get_location(self, metadata):
        return metadata.get("filename")
