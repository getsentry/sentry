from __future__ import absolute_import

from six.moves.urllib.parse import urljoin
import re


_scheme_re = re.compile(r"^([a-zA-Z0-9-+]+://)(.*)$")


def non_standard_url_join(base, to_join):
    """A version of url join that can deal with unknown protocols."""
    # joins to an absolute url are willing by default
    if not to_join:
        return base

    match = _scheme_re.match(to_join)
    if match is not None:
        return to_join

    match = _scheme_re.match(base)
    if match is not None:
        original_base_scheme, rest = match.groups()
        base = "http://" + rest
    else:
        original_base_scheme = None

    rv = urljoin(base, to_join)
    if original_base_scheme is not None:
        match = _scheme_re.match(rv)
        if match is not None:
            return original_base_scheme + match.group(2)

    return rv
