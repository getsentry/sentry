from __future__ import annotations

import re
from os.path import splitext
from typing import List, Tuple
from urllib.parse import urlsplit

# number of surrounding lines (on each side) to fetch
LINES_OF_CONTEXT = 5


def get_source_context(
    source: List[bytes], lineno: int, context=LINES_OF_CONTEXT
) -> Tuple[List[bytes] | None, bytes | None, List[bytes] | None]:
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


def trim_line(line: str, column=0) -> str:
    """
    Trims a line down to a goal of 140 characters, with a little
    wiggle room to be sensible and tries to trim around the given
    `column`. So it tries to extract 60 characters before and after
    the provided `column` and yield a better context.
    """
    line = line.strip("\r\n")
    ll = len(line)
    if ll <= 150:
        return line
    if column > ll:
        column = ll
    start = max(column - 60, 0)
    # Round down if it brings us close to the edge
    if start < 5:
        start = 0
    end = min(start + 140, ll)
    # Round up to the end if it's close
    if end > ll - 5:
        end = ll
    # If we are bumped all the way to the end,
    # make sure we still get a full 140 characters in the line
    if end == ll:
        start = max(end - 140, 0)
    line = line[start:end]
    if end < ll:
        # we've snipped from the end
        line += " {snip}"
    if start > 0:
        # we've snipped from the beginning
        line = "{snip} " + line
    return line


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

    filename, ext = splitext(urlsplit(src).path)
    if filename.endswith(".min"):
        filename = filename[:-4]

    # TODO(dcramer): replace CLEAN_MODULE_RE with tokenizer completely
    tokens = filename.split("/")
    for idx, token in enumerate(tokens):
        # a SHA
        if VERSION_RE.match(token):
            return "/".join(tokens[idx + 1 :])

    return CLEAN_MODULE_RE.sub("", filename) or UNKNOWN_MODULE
