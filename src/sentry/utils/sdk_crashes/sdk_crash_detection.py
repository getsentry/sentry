from __future__ import annotations

from typing import Any, Mapping, Sequence

from sentry.eventstore.models import Event
from sentry.utils.glob import glob_match


def detect_sdk_crash(data: Event):
    event_id = data.get("event_id", None)
    if event_id is None:
        return
    return


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
