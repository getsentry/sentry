import re
from collections.abc import Mapping
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlsplit, urlunparse

_scheme_re = re.compile(r"^([a-zA-Z0-9-+]+://)(.*)$")


def non_standard_url_join(base: str, to_join: str | None) -> str:
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


def add_params_to_url(url: str, params: Mapping[str, str]) -> str:
    url_parts = urlparse(url)
    query = dict(parse_qsl(url_parts.query))
    query.update(params)
    url_parts = url_parts._replace(query=urlencode(query))
    return urlunparse(url_parts)


def urlsplit_best_effort(s: str) -> tuple[str, str, str, str]:
    """first attempts urllib parsing, falls back to crude parsing for invalid urls"""
    try:
        parsed = urlsplit(s)
    except ValueError:
        rest, _, query = s.partition("?")
        scheme, _, rest = rest.partition("://")
        netloc, slash, path = rest.partition("/")
        path = f"{slash}{path}"
        return scheme, netloc, path, query
    else:
        return parsed.scheme, parsed.netloc, parsed.path, parsed.query


def parse_id_or_slug_param(id_or_slug: str | None) -> tuple[int | None, str | None]:
    if not id_or_slug:
        return None, None

    if id_or_slug.isnumeric():
        return int(id_or_slug), None
    return None, id_or_slug
