"""
This file implements the legacy culprit system.  The culprit at this point is
just used as a fallback if no transaction is set.  When a transaction is set
the culprit is overridden by the transaction value.

Over time we want to fully phase out the culprit.  Until then this is the
code that generates it.
"""

from collections.abc import Mapping, Sequence
from typing import cast

from sentry.constants import MAX_CULPRIT_LENGTH, NEL_CULPRITS
from sentry.utils.safe import get_path
from sentry.utils.strings import truncatechars


def generate_culprit(data: Mapping[str, object]) -> str:
    platform = data.get("platform")
    exceptions = get_path(data, "exception", "values", filter=True)
    if exceptions:
        # Synthetic events no longer get a culprit
        last_exception = get_path(exceptions, -1)
        if get_path(last_exception, "mechanism", "synthetic"):
            return ""

        stacktraces = [e["stacktrace"] for e in exceptions if get_path(e, "stacktrace", "frames")]
    else:
        stacktrace = cast(Mapping[str, object] | None, data.get("stacktrace"))
        if stacktrace and stacktrace.get("frames"):
            stacktraces = [stacktrace]
        else:
            stacktraces = None

    culprit = None

    if not culprit and stacktraces:
        culprit = get_stacktrace_culprit(
            get_path(stacktraces, -1), platform=cast(str | None, platform)
        )

    if not culprit and data.get("type") and data.get("type") == "nel":
        culprit = get_nel_culprit(cast(Mapping[str, object], data.get("contexts")))

    if not culprit and data.get("request"):
        culprit = get_path(data, "request", "url")

    return truncatechars(culprit or "", MAX_CULPRIT_LENGTH)


def get_stacktrace_culprit(stacktrace: Mapping[str, object], platform: str | None) -> str | None:
    default = None
    for frame in reversed(cast(Sequence[Mapping[str, object]], stacktrace["frames"])):
        if not frame:
            continue
        if frame.get("in_app"):
            culprit = get_frame_culprit(frame, platform=platform)
            if culprit:
                return culprit
        elif default is None:
            default = get_frame_culprit(frame, platform=platform)
    return default


def get_frame_culprit(frame: Mapping[str, object], platform: str | None) -> str:
    # If this frame has a platform, we use it instead of the one that
    # was passed in (as that one comes from the exception which might
    # not necessarily be the same platform).
    platform = cast(str | None, frame.get("platform") or platform)
    if platform in ("objc", "cocoa", "native"):
        return cast(str, frame.get("function") or "?")
    fileloc = frame.get("module") or frame.get("filename")
    if not fileloc:
        return ""
    elif platform in ("javascript", "node"):
        # function and fileloc might be unicode here, so let it coerce
        # to a unicode string if needed.
        return "{}({})".format(frame.get("function") or "?", fileloc)
    return "{} in {}".format(fileloc, frame.get("function") or "?")


def get_nel_culprit(contexts: Mapping[str, object]) -> str:
    nel = cast(Mapping[str, object], contexts.get("nel"))
    ty = cast(str, nel.get("error_type", "<missing>"))
    if ty == "http.error":
        # justification: the NEL http.error context carries a response mapping.
        response = cast(Mapping[str, object], contexts.get("response"))
        return NEL_CULPRITS[ty].format(response.get("status_code"))
    return NEL_CULPRITS.get(ty, ty)
