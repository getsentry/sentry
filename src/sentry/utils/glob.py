import re
from functools import lru_cache
from typing import Union


@lru_cache(maxsize=500)
def _translate(pat, doublestar=False):
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
    pat: Union[bytes, str],
    doublestar: bool = False,
    ignorecase: bool = False,
    path_normalize: bool = False,
) -> bool:
    """A beefed up version of fnmatch.fnmatch"""
    value_str = value if isinstance(value, str) else value.decode()
    pat_str = pat if isinstance(pat, str) else pat.decode()
    if ignorecase:
        value_str = value_str.lower()
        pat_str = pat_str.lower()
    if path_normalize:
        value_str = value_str.replace("\\", "/")
        pat_str = pat_str.replace("\\", "/")
    return _translate(pat_str, doublestar=doublestar).match(value_str) is not None
