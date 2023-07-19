from __future__ import annotations

from wsgiref.util import is_hop_by_hop

from django.test import override_settings
from requests.structures import CaseInsensitiveDict

from sentry.silo.util import (
    INVALID_OUTBOUND_HEADERS,
    INVALID_PROXY_HEADERS,
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    clean_headers,
    clean_outbound_headers,
    clean_proxy_headers,
    encode_subnet_signature,
    trim_leading_slashes,
    verify_subnet_signature,
)
from sentry.testutils import TestCase


class SiloUtilityTest(TestCase):
    headers = CaseInsensitiveDict(
        data={
            "User-Agent": "Chrome",
            "Authorization": "Bearer tkn",
            "Host": "sentry.io",
            "Content-Length": "27",
            "Content-Encoding": "deflate, gzip",
            PROXY_OI_HEADER: "12",
            PROXY_SIGNATURE_HEADER: "-leander(but-in-cursive)",
            "X-Test-Header-1": "One",
            "X-Test-Header-2": "Two",
            "X-Test-Header-3": "Three",
            "X-Forwarded-Proto": "https",
        }
    )
    secret = "hush-hush-im-invisible"

    def test_trim_leading_slashes(self):
        assert trim_leading_slashes("/happy-path") == "happy-path"
        assert trim_leading_slashes("/a/bit/nested") == "a/bit/nested"
        assert trim_leading_slashes("/////way-nested") == "way-nested"
        assert trim_leading_slashes("/") == ""
        assert trim_leading_slashes("not-nested-at-all") == "not-nested-at-all"
        assert trim_leading_slashes("/url-safe?query=h%20c%20") == "url-safe?query=h%20c%20"

    def test_clean_headers(self):
        assert clean_headers(self.headers, []) == self.headers

        assert "X-Test-Header-4" not in self.headers
        assert clean_headers(self.headers, ["X-Test-Header-4"]) == self.headers

        assert "X-Test-Header-1" in self.headers
        cleaned = clean_headers(self.headers, ["X-Test-Header-1"])
        assert "X-Test-Header-1" not in cleaned
        assert len(cleaned) == len(self.headers) - 1

    def test_clean_proxy_headers(self):
        cleaned = clean_proxy_headers(self.headers)
        for header in INVALID_PROXY_HEADERS:
            assert header in self.headers
            assert header not in cleaned

        retained_headers = filter(lambda k: k not in INVALID_PROXY_HEADERS, self.headers.keys())
        for header in retained_headers:
            assert self.headers[header] == cleaned[header]

    def test_clean_outbound_headers(self):
        cleaned = clean_outbound_headers(self.headers)
        for header in INVALID_OUTBOUND_HEADERS:
            assert header in self.headers
            assert header not in cleaned

        retained_headers = filter(lambda k: k not in INVALID_OUTBOUND_HEADERS, self.headers.keys())
        for header in retained_headers:
            assert self.headers[header] == cleaned[header]

    def test_clean_hop_by_hop_headers(self):
        headers = {
            **self.headers,
            "Keep-Alive": "timeout=5",
            "Transfer-Encoding": "chunked",
            "Proxy-Authenticate": "Basic",
        }
        hop_by_hop_headers = ["Keep-Alive", "Transfer-Encoding", "Proxy-Authenticate"]

        cleaned = clean_headers(headers, invalid_headers=[])

        for header in hop_by_hop_headers:
            assert header in headers
            assert header not in cleaned

        retained_headers = filter(lambda k: not is_hop_by_hop(k), headers.keys())
        for header in retained_headers:
            assert headers[header] == cleaned[header]

    @override_settings(SENTRY_SUBNET_SECRET=secret)
    def test_subnet_signature(self):
        signature = "v0=baac3ac029e96ef4df5d5334af73a1ff6f4c9106d39cb57ceeff60d59ce829d6"

        def _encode(
            secret: str = self.secret,
            path: str = "/chat.postMessage",
            identifier: str = "21",
            request_body: bytes | None = b'{"some": "payload"}',
        ) -> str:
            return encode_subnet_signature(
                secret=secret, path=path, identifier=identifier, request_body=request_body
            )

        def _verify(
            path: str = "/chat.postMessage",
            identifier: str = "21",
            request_body: bytes | None = b'{"some": "payload"}',
            provided_signature: str = signature,
        ) -> bool:
            return verify_subnet_signature(
                path=path,
                identifier=identifier,
                request_body=request_body,
                provided_signature=provided_signature,
            )

        assert _encode() == signature
        assert _verify()

        # We trim slashes prior to encoding/verifying
        assert _encode(path="chat.postMessage") == signature
        assert _verify(path="chat.postMessage")

        # Wrong secrets not be verifiable
        wrong_secret_signature = _encode(secret="wrong-secret")
        assert wrong_secret_signature != signature
        assert not _verify(provided_signature=wrong_secret_signature)

        # Any mishandled field should not be verifiable
        assert _encode(path="incorrect-data") != signature
        assert not _verify(path="incorrect-data")
        assert _encode(identifier="incorrect-data") != signature
        assert not _verify(identifier="incorrect-data")
        assert _encode(request_body=b"incorrect-data") != signature
        assert not _verify(request_body=b"incorrect-data")
