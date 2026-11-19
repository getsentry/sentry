from __future__ import annotations

import re
from os.path import splitext
from typing import Any
from urllib.parse import urlsplit

from sentry.stacktraces.processing import StacktraceInfo

# number of surrounding lines (on each side) to fetch
LINES_OF_CONTEXT = 5


# Platform values that should mark an event
# or frame as being JavaScript for the purposes
# of symbolication.
JAVASCRIPT_PLATFORMS = ("javascript", "node")


def get_source_context(
    source: list[bytes], lineno: int, context: int = LINES_OF_CONTEXT
) -> tuple[list[bytes] | None, bytes | None, list[bytes] | None]:
    if not source:
        return None, None, None

    # lineno's in JS are 1-indexed
    # just in case. sometimes math is hard
    if lineno > 0:
        lineno -= 1

    lower_bound = max(0, lineno - context)
    upper_bound = min(lineno + 1 + context, len(source))

    try:
        pre_context = source[lower_bound:lineno]
    except IndexError:
        pre_context = []

    try:
        context_line = source[lineno]
    except IndexError:
        context_line = b""

    try:
        post_context = source[(lineno + 1) : upper_bound]
    except IndexError:
        post_context = []

    return pre_context or None, context_line, post_context or None


UNKNOWN_MODULE = "<unknown module>"
CLEAN_MODULE_RE = re.compile(
    r"""^
(?:/|  # Leading slashes
(?:
    (?:java)?scripts?|js|build|static|node_modules|bower_components|[_\.~].*?|  # common folder prefixes
    v?(?:\d+\.)*\d+|   # version numbers, v1, 1.0.0
    [a-f0-9]{7,8}|     # short sha
    [a-f0-9]{32}|      # md5
    [a-f0-9]{40}       # sha1
)/)+|
(?:[-\.][a-f0-9]{7,}$)  # Ending in a commitish
""",
    re.X | re.I,
)
VERSION_RE = re.compile(r"^[a-f0-9]{32}|[a-f0-9]{40}$", re.I)


def generate_module(src: str | None) -> str:
    """
    Converts a url into a made-up module name by doing the following:
     * Extract just the path name ignoring querystrings
     * Trimming off the initial /
     * Trimming off the file extension
     * Removes off useless folder prefixes

    e.g. http://google.com/js/v1.0/foo/bar/baz.js -> foo/bar/baz
    """
    if not src:
        return UNKNOWN_MODULE

    try:
        filename, ext = splitext(urlsplit(src).path)
    except ValueError:
        return UNKNOWN_MODULE
    if filename.endswith(".min"):
        filename = filename[:-4]

    # TODO(dcramer): replace CLEAN_MODULE_RE with tokenizer completely
    tokens = filename.split("/")
    for idx, token in enumerate(tokens):
        # a SHA
        if VERSION_RE.match(token):
            return "/".join(tokens[idx + 1 :])

    return CLEAN_MODULE_RE.sub("", filename) or UNKNOWN_MODULE


def is_js_event(data: Any, stacktraces: list[StacktraceInfo]) -> bool:
    """Returns whether `data` is a JS event, based on its platform and
    the supplied stacktraces."""

    if data.get("platform") in JAVASCRIPT_PLATFORMS:
        return True

    for stacktrace in stacktraces:
        # The platforms of a stacktrace are exactly the platforms of its frames
        # so this is tantamount to checking if any frame has a JS platform.
        if any(x in JAVASCRIPT_PLATFORMS for x in stacktrace.platforms):
            return True

    return False
