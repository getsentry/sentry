from __future__ import annotations

from typing import Any, Mapping, Sequence

from sentry.eventstore.models import Event
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path


def detect_sdk_crash(data: Event) -> bool:
    if data.get("type") != "error" or data.get("platform") != "cocoa":
        return False

    is_unhandled = get_path(data, "exception", "values", -1, "mechanism", "handled") is False

    if is_unhandled is False:
        return False

    frames = get_path(data, "exception", "values", -1, "stacktrace", "frames")
    if not frames:
        return False

    if is_cocoa_sdk_crash(frames):
        return True

    return False


def is_cocoa_sdk_crash(frames: Sequence[Mapping[str, Any]]) -> bool:
    """
    Returns true if the stacktrace is a Cocoa SDK crash.

    :param frames: The stacktrace frames ordered from newest to oldest.
    """
    if not frames:
        return False

    for frame in frames:

        function = frame.get("function")

        if function is not None:
            # [SentrySDK crash] is a testing function causing a crash.
            # Therefore, we don't want to mark it a as a SDK crash.
            if "SentrySDK crash" in function:
                return False

            functionsMatchers = ["*sentrycrash*", "**[[]Sentry*"]
            for matcher in functionsMatchers:
                if glob_match(frame.get("function"), matcher, ignorecase=True):
                    return True

        filename = frame.get("filename")
        if filename is not None:
            filenameMatchers = ["Sentry**"]
            for matcher in filenameMatchers:
                if glob_match(filename, matcher, ignorecase=True):
                    return True

        if frame.get("in_app") is True:
            return False

    return False
