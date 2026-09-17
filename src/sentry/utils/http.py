from __future__ import annotations

from collections.abc import Collection, Iterator
from typing import TYPE_CHECKING, Any, NamedTuple, TypeGuard, overload
from urllib.parse import quote, urljoin, urlparse

from asgiref.sync import sync_to_async
from django.conf import settings
from django.http import HttpRequest
from rest_framework.request import Request

from sentry import options

if TYPE_CHECKING:
    from sentry.models.project import Project

from ipaddress import ip_address, ip_interface, ip_network

# User-agent prefix set by the official Sentry MCP server (source of truth:
# getsentry/sentry-mcp). Used to attribute requests originating from the MCP.
MCP_USER_AGENT_PREFIX = "sentry-mcp/"

MCP_CLIENT_FAMILY_HEADER = "HTTP_X_SENTRY_MCP_CLIENT_FAMILY"

# Standardized client families the MCP buckets its callers into and forwards via
# X-Sentry-MCP-Client-Family (source of truth: client-family.ts in getsentry/sentry-mcp).
KNOWN_MCP_CLIENT_FAMILIES = frozenset(
    {"claude-code", "cursor", "copilot", "opencode", "claude-desktop", "codex"}
)
MCP_CATCHALL_CLIENT_FAMILIES = frozenset({"other", "unknown"})

# Header Seer sets on the API calls it makes on a user's behalf. Shared so that
# every caller-attribution site keys off the same signal (see `sentry.api.client_kind`
# and `sentry.issues.action_log`).
SEER_REFERRER_HEADER = "HTTP_X_SEER_REFERRER"


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


def query_string(request: HttpRequest) -> str:
    qs = request.META.get("QUERY_STRING") or ""
    if qs:
        qs = f"?{qs}"
    return qs


def create_redirect_url(request: HttpRequest, redirect_url: str) -> str:
    qs = query_string(request)
    return f"{redirect_url}{qs}"


@overload
def origin_from_url(url: str) -> str: ...


@overload
def origin_from_url(url: None) -> None: ...


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
    origin: str | None, project: Project | None = None, allowed: Collection[str] | None = None
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


def is_mcp_request(request: HttpRequest | Request) -> bool:
    """
    Whether the request originated from the official Sentry MCP server, identified
    by its `sentry-mcp/` user-agent prefix.
    """
    return request.META.get("HTTP_USER_AGENT", "").startswith(MCP_USER_AGENT_PREFIX)


def get_mcp_client_family(request: HttpRequest | Request) -> str | None:
    """The client family (`claude-code`, `cursor`, ...) the MCP server declares for its caller.

    Returns None when the header is absent or the MCP bucketed the caller into a catch-all.
    A value outside `KNOWN_MCP_CLIENT_FAMILIES` is still returned: this set can lag
    client-family.ts upstream, so callers decide whether to log the unrecognized value.

    Declared by the client, so untrusted -- unlike `is_mcp_request`, which is derived.
    """
    family = request.META.get(MCP_CLIENT_FAMILY_HEADER, "").strip().lower()
    if not family or family in MCP_CATCHALL_CLIENT_FAMILIES:
        return None
    return family


def percent_encode(val: str) -> str:
    # see https://en.wikipedia.org/wiki/Percent-encoding
    return quote(val).replace("%7E", "~").replace("/", "%2F")


class _HttpRequestWithSubdomain(HttpRequest):
    """typing-only: to help with hinting for `.subdomain`"""

    subdomain: str


def is_using_customer_domain(request: HttpRequest) -> TypeGuard[_HttpRequestWithSubdomain]:
    return bool(hasattr(request, "subdomain") and request.subdomain)


def is_valid_ip(maybe_ip_str: str) -> bool:
    # Validate the string by attempting to pass it to the three built-in factory functions for
    # creating different types of ip address objects. If any of them succeeds, it's a valid IP. If
    # all three raise an error, it's not.
    for fn, kwargs in (
        (ip_address, {}),
        (ip_interface, {}),
        (ip_network, {"strict": False}),  # `strict: False` allows host bits
    ):
        try:
            fn(maybe_ip_str, **kwargs)
        except ValueError:
            pass
        else:
            return True

    return False


class BodyAsyncWrapper:
    def __init__(self, body: Any):
        self._bool = bool(body)
        self.body = [body] if isinstance(body, bytes) else body

    def __bool__(self) -> bool:
        return self._bool

    def __aiter__(self):
        return BodyAsyncIter(self)


class BodyAsyncIter:
    def __init__(self, parent: BodyAsyncWrapper):
        self.biter = iter(parent.body)

    def _anext(self):
        try:
            return self.biter.__next__()
        except StopIteration:
            raise StopAsyncIteration

    async def __anext__(self) -> bytes:
        return await sync_to_async(self._anext)()


class BodyWithLength:
    """Wraps an HttpRequest with a __len__ so that the requests library does not assume length=0 in all cases"""

    def __init__(self, request: HttpRequest):
        self.request = request

    def __iter__(self) -> Iterator[bytes]:
        return iter(self.request)

    def __aiter__(self) -> BodyWithLengthAiter:
        return BodyWithLengthAiter(self)

    def __len__(self) -> int:
        return int(self.request.headers.get("Content-Length", "0"))

    def read(self, size: int | None = None) -> bytes:
        return self.request.read(size)


class BodyWithLengthAiter:
    def __init__(self, parent: BodyWithLength):
        self.biter = iter(parent.request)

    def _anext(self):
        try:
            return self.biter.__next__()
        except StopIteration:
            raise StopAsyncIteration

    async def __anext__(self) -> bytes:
        return await sync_to_async(self._anext)()
