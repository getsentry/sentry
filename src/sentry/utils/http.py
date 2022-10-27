from __future__ import annotations

from typing import TYPE_CHECKING, NamedTuple, overload
from urllib.parse import quote, urljoin, urlparse

from django.conf import settings
from django.http import HttpRequest
from rest_framework.request import Request

from sentry import options

if TYPE_CHECKING:
    from sentry.models.project import Project


class ParsedUriMatch(NamedTuple):
    scheme: str
    domain: str
    path: str


def absolute_uri(url: str | None = None, url_prefix: str | None = None) -> str:
    if url_prefix is None:
        url_prefix = options.get("system.url-prefix")
    if not url:
        return url_prefix
    parsed = urlparse(url)
    if parsed.hostname is not None:
        url_prefix = origin_from_url(url)
    return urljoin(url_prefix.rstrip("/") + "/", url.lstrip("/"))


def create_redirect_url(request: Request, redirect_url: str) -> str:
    qs = request.META.get("QUERY_STRING") or ""
    if qs:
        qs = "?" + qs
    return f"{redirect_url}{qs}"


@overload
def origin_from_url(url: str) -> str:
    ...


@overload
def origin_from_url(url: None) -> None:
    ...


def origin_from_url(url: str | None) -> str | None:
    if not url:
        return url
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def get_origins(project: Project | None = None) -> frozenset[str]:
    if not project:
        if settings.SENTRY_ALLOW_ORIGIN in ("*", None):
            result = ["*"]
        elif settings.SENTRY_ALLOW_ORIGIN:
            result = settings.SENTRY_ALLOW_ORIGIN.split(" ")
        else:
            result = []
    else:
        optval = project.get_option("sentry:origins", ["*"])
        if optval:
            result = optval
        else:
            result = []

    # lowercase and strip the trailing slash from all origin values
    # filter out empty values
    return frozenset(filter(bool, map(lambda x: (x or "").lower().rstrip("/"), result)))


def parse_uri_match(value: str) -> ParsedUriMatch:
    if "://" in value:
        scheme, value = value.split("://", 1)
    else:
        scheme = "*"

    if "/" in value:
        domain, path = value.split("/", 1)
    else:
        domain, path = value, "*"

    if ":" in domain:
        domain, port = value.split(":", 1)
    else:
        port = None

    # we need to coerce our unicode inputs into proper
    # idna/punycode encoded representation for normalization.
    domain = domain.encode("idna").decode()

    if port:
        domain = f"{domain}:{port}"

    return ParsedUriMatch(scheme, domain, path)


def is_valid_origin(
    origin: str, project: Project | None = None, allowed: frozenset[str] | None = None
) -> bool:
    """
    Given an ``origin`` which matches a base URI (e.g. http://example.com)
    determine if a valid origin is present in the project settings.

    Origins may be defined in several ways:

    - http://domain.com[:port]: exact match for base URI (must include port)
    - *: allow any domain
    - *.domain.com: matches domain.com and all subdomains, on any port
    - domain.com: matches domain.com on any port
    - *:port: wildcard on hostname, but explicit match on port
    """
    if allowed is None:
        allowed = get_origins(project)

    if not allowed:
        return False

    if "*" in allowed:
        return True

    if not origin:
        return False

    # we always run a case insensitive check
    origin = origin.lower()

    # Fast check
    if origin in allowed:
        return True

    # XXX: In some cases origin might be localhost (or something similar) which causes a string value
    # of 'null' to be sent as the origin
    if origin == "null":
        return False

    parsed = urlparse(origin)

    if parsed.hostname is None:
        parsed_hostname = ""
    else:
        try:
            parsed_hostname = parsed.hostname.encode("idna").decode("utf-8")
        except UnicodeError:
            # We sometimes shove in some garbage input here, so just opting to ignore and carry on
            parsed_hostname = parsed.hostname

    if parsed.port:
        domain_matches: tuple[str, ...] = (
            "*",
            parsed_hostname,
            # Explicit hostname + port name
            "%s:%d" % (parsed_hostname, parsed.port),
            # Wildcard hostname with explicit port
            "*:%d" % parsed.port,
        )
    else:
        domain_matches = ("*", parsed_hostname)

    for value in allowed:
        try:
            bits = parse_uri_match(value)
        except UnicodeError:
            # We hit a bad uri, so ignore this value
            continue

        # scheme supports exact and any match
        if bits.scheme not in ("*", parsed.scheme):
            continue

        # domain supports exact, any, and prefix match
        if bits.domain[:2] == "*.":
            if parsed_hostname.endswith(bits.domain[1:]) or parsed_hostname == bits.domain[2:]:
                return True
            continue
        elif bits.domain not in domain_matches:
            continue

        # path supports exact, any, and suffix match (with or without *)
        path = bits.path
        if path == "*":
            return True
        if path.endswith("*"):
            path = path[:-1]
        if parsed.path.startswith(path):
            return True
    return False


def origin_from_request(request: HttpRequest) -> str | None:
    """
    Returns either the Origin or Referer value from the request headers,
    ignoring "null" Origins.
    """
    rv: str | None = request.META.get("HTTP_ORIGIN", "null")
    # In some situation, an Origin header may be the literal value
    # "null". This means that the Origin header was stripped for
    # privacy reasons, but we should ignore this value entirely.
    # Behavior is specified in RFC6454. In either case, we should
    # treat a "null" Origin as a nonexistent one and fallback to Referer.
    if rv in ("", "null"):
        rv = origin_from_url(request.META.get("HTTP_REFERER"))
    return rv


def percent_encode(val: str) -> str:
    # see https://en.wikipedia.org/wiki/Percent-encoding
    return quote(val).replace("%7E", "~").replace("/", "%2F")
