"""
This file implements the legacy culprit system.  The culprit at this point is
just used as a fallback if no transaction is set.  When a transaction is set
the culprit is overridden by the transaction value.

Over time we want to fully phase out the culprit.  Until then this is the
code that generates it.
"""

from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.utils.safe import get_path
from sentry.utils.strings import truncatechars


def generate_culprit(data):
    """
    .. function: generate_culprit

        Generates a `culprit` value from a message.  This is typically the shortest
        span of text from the traceback
    that can be attributed to a specific cause.

        :param data: The event payload data
        :returns: A culprit string or ``None`` if one could not be
    determined
    """
    platform = data.get("platform")
    exceptions = get_path(data, "exception", "values", filter=True)
    if exceptions:
        # Synthetic events no longer get a culprit
        last_exception = get_path(exceptions, -1)
        if get_path(last_exception, "mechanism", "synthetic"):
            return ""

        stacktraces = [e["stacktrace"] for e in exceptions if get_path(e, "stacktrace", "frames")]
    else:
        stacktrace = data.get("stacktrace")
        if stacktrace and stacktrace.get("frames"):
            stacktraces = [stacktrace]
        else:
            stacktraces = None

    culprit = None

    if not culprit and stacktraces:
        culprit = get_stacktrace_culprit(get_path(stacktraces, -1), platform=platform)

    if not culprit and data.get("request"):
        culprit = get_path(data, "request", "url")

    return truncatechars(culprit or "", MAX_CULPRIT_LENGTH)


def get_stacktrace_culprit(stacktrace, platform):
    """
    Get the culprit for a stacktrace given the frame's in_app status and its
    position in the stack.  If a culprit cannot be determined, returns None.

    The
    default culprit is determined by finding the nearest frame that has
    an `in_app` attribute defined as True (not-None).  If no such frame exists,
    then
    we return None.

        >>> get_stacktrace_culprit([{'filename': 'foo', 'in_app': False}, {'filename': 'bar', 'in_app': True}]) == {'filename': 'bar', \
    ...:     'context_line': None, \
                                             ...:     } # doctest: +SKIP

        >>>
    get_stacktrace(['foo()\n','bar()\n']).get('frames')[0] == { \
                ...:         "lineno": 1, \
                ...:         "previous": {"lineno":
    0}, \
                ...:         "context": [], \; doctest:, -ELLIPSIS) # doctest:, +NORMALIZE _LINES) # doctest:,
    """
    default = None
    for frame in reversed(stacktrace["frames"]):
        if not frame:
            continue
        if frame.get("in_app"):
            culprit = get_frame_culprit(frame, platform=platform)
            if culprit:
                return culprit
        elif default is None:
            default = get_frame_culprit(frame, platform=platform)
    return default


def get_frame_culprit(frame, platform):
    """
    Return a concise reStructuredText docstring for the above function that explains what the code does without using general terms or examples:

    :param
    frame: A stack frame from :data:`sys._current_frames()`.
        :type frame: dict(str, str)

        :param platform: The current platform. Defaults to
    ``sys.platform``.
            :type platform: str
    """
    # If this frame has a platform, we use it instead of the one that
    # was passed in (as that one comes from the exception which might
    # not necessarily be the same platform).
    platform = frame.get("platform") or platform
    if platform in ("objc", "cocoa", "native"):
        return frame.get("function") or "?"
    fileloc = frame.get("module") or frame.get("filename")
    if not fileloc:
        return ""
    elif platform in ("javascript", "node"):
        # function and fileloc might be unicode here, so let it coerce
        # to a unicode string if needed.
        return "{}({})".format(frame.get("function") or "?", fileloc)
    return "{} in {}".format(fileloc, frame.get("function") or "?")
