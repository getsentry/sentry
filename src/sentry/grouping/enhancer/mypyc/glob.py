""" This is a replacement for sentry.utils.glob, which uses librelay """


import re
from typing import Union


def translate(pat: str, doublestar: bool = False) -> "re.Pattern[str]":
    """Restored from https://github.com/getsentry/sentry/pull/15419/"""
    i, n = 0, len(pat)
    res = []
    while i < n:
        c = pat[i]
        i = i + 1
        if c == "*":
            if doublestar:
                if pat[i : i + 1] == "*":
                    res.append(".*")
                    i += 1
                else:
                    res.append("[^/]*")
            else:
                res.append(".*")
        elif c == "?":
            res.append(".")
        elif c == "[":
            j = i
            if j < n and pat[j] == "!":
                j = j + 1
            if j < n and pat[j] == "]":
                j = j + 1
            while j < n and pat[j] != "]":
                j = j + 1
            if j >= n:
                res.append("\\[")
            else:
                stuff = pat[i:j].replace("\\", "\\\\")
                i = j + 1
                if stuff[0] == "!":
                    stuff = "^" + stuff[1:]
                elif stuff[0] == "^":
                    stuff = "\\" + stuff
                res.append("[%s]" % stuff)
        else:
            res.append(re.escape(c))
    res.append(r"\Z")
    return re.compile("".join(res), re.MULTILINE | re.DOTALL)


def glob_match(
    value: Union[bytes, str],
    compiled_pattern: "re.Pattern[str]",
    ignorecase: bool = False,
    path_normalize: bool = False,
) -> bool:
    value_str = value if isinstance(value, str) else value.decode()
    if ignorecase:
        value_str = value_str.lower()
    if path_normalize:
        value_str = value_str.replace("\\", "/")
    return compiled_pattern.match(value_str) is not None
