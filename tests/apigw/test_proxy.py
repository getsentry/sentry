import httpx
from emmett55 import current
from emmett_core.http.response import HTTPResponse
from emmett_core.protocols.rsgi.wrappers import Response

from apigw.proxy import adapt_response, build_proxied_cell_headers, build_proxied_headers


class FakeScope:
    client = "10.11.12.13:51234"


class FakeHeaders:
    def __init__(self, items: list[tuple[str, str]]):
        self._items = items

    def keys(self) -> list[str]:
        return list(dict.fromkeys(key for key, _ in self._items))

    def get_all(self, key: str) -> list[str]:
        return [val for k, val in self._items if k == key]


class FakeRequest:
    def __init__(self, headers: list[tuple[str, str]], host: str = "sentry.io"):
        self._scope = FakeScope()
        self.headers = FakeHeaders(headers)
        self.host = host


def test_proxied_headers_filtering() -> None:
    request = FakeRequest(
        [
            ("host", "sentry.io"),
            ("connection", "keep-alive"),
            ("authorization", "Bearer token"),
            ("accept", "application/json"),
            ("accept", "text/html"),
        ]
    )
    headers = build_proxied_headers(request, "http://cell-1.internal:9000")
    keys = [key for key, _ in headers]

    # host is replaced with the target netloc, connection is dropped
    assert keys.count("host") == 1
    assert ("host", "cell-1.internal:9000") in headers
    assert "connection" not in keys
    # remaining headers pass through, multi-value ones keep every value
    assert ("authorization", "Bearer token") in headers
    assert [val for key, val in headers if key == "accept"] == ["application/json", "text/html"]
    # the client address is recorded
    assert ("x-forwarded-for", "10.11.12.13") in headers


def test_proxied_headers_host_passthrough() -> None:
    request = FakeRequest([("host", "sentry.io")])
    headers = build_proxied_headers(request, "http://cell-1.internal:9000", pass_host=True)

    assert ("host", "sentry.io") in headers


def test_proxied_headers_forwarded_for_append() -> None:
    request = FakeRequest([("x-forwarded-for", "203.0.113.7")])
    headers = build_proxied_headers(request, "http://cell-1.internal:9000")

    assert [val for key, val in headers if key == "x-forwarded-for"] == ["203.0.113.7, 10.11.12.13"]


def test_proxied_cell_headers_gateway_marker() -> None:
    request = FakeRequest([])
    headers = build_proxied_cell_headers(request, "http://cell-1.internal:9000")

    assert ("x-apigateway", "true") in headers


def test_adapt_response_headers_and_cookies() -> None:
    upstream = httpx.Response(
        301,
        headers=[
            ("set-cookie", "session=abc; Path=/; HttpOnly"),
            ("set-cookie", "csrf=xyz; Path=/"),
            ("server", "nginx"),
            ("connection", "close"),
            ("x-sentry-subnet-signature", "sig"),
            ("location", "https://sentry.io/"),
            ("vary", "Accept"),
            ("vary", "Cookie"),
        ],
    )

    # bind a real emmett response to the current context, as the app would
    try:
        current.response = Response(None)

        # the returned coroutine streams the body to the protocol; the
        # response adaptation we validate here already happened
        adapt_response(upstream).close()

        # render the wire headers exactly as emmett would for the final response
        http_response = HTTPResponse(
            current.response.status,
            headers=current.response.headers,
            cookies=current.response.cookies,
        )
        wire_headers = list(http_response.rsgi_headers())
        wire_keys = [key for key, _ in wire_headers]

        assert current.response.status == 301
        # hop-by-hop and internal headers are dropped
        assert "server" not in wire_keys
        assert "connection" not in wire_keys
        assert "x-sentry-subnet-signature" not in wire_keys
        # plain headers pass through, repeated ones are merged
        assert ("location", "https://sentry.io/") in wire_headers
        assert ("vary", "Accept,Cookie") in wire_headers
        # every upstream set-cookie header becomes its own set-cookie
        # header line on the wire, in order and unmangled
        assert [val for key, val in wire_headers if key == "set-cookie"] == [
            "session=abc; Path=/; HttpOnly",
            "csrf=xyz; Path=/",
        ]
    finally:
        del current.response
