import re
from typing import MutableMapping, Sequence, Union
from urllib.parse import parse_qs, parse_qsl, urlencode, urljoin, urlparse, urlunparse

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


def add_params_to_url(url, params):
    url_parts = urlparse(url)
    query = dict(parse_qsl(url_parts.query))
    query.update(params)
    url_parts = url_parts._replace(query=urlencode(query))
    return urlunparse(url_parts)


def parse_link(url: str) -> str:
    """For data aggregation purposes, remove unique information from URL."""

    url_parts = list(urlparse(url))
    query: MutableMapping[str, Union[Sequence[str], str]] = dict(parse_qs(url_parts[4]))
    for param in query:
        if param == "project":
            query.update({"project": "{project}"})

    url_parts[4] = urlencode(query)
    parsed_path = url_parts[2].strip("/").split("/")
    scrubbed_items = {"organizations": "organization", "issues": "issue_id", "events": "event_id"}
    new_path = []
    for index, item in enumerate(parsed_path):
        if item in scrubbed_items:
            if len(parsed_path) > index + 1:
                parsed_path[index + 1] = "{%s}" % (scrubbed_items[item])
        new_path.append(item)

    return "/".join(new_path) + "/" + str(url_parts[4])
