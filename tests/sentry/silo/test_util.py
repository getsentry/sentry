from django.test import override_settings

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
    headers = {
        "User-Agent": "Chrome",
        "Keep-Alive": "timeout=5",
        "Authorization": "Bearer tkn",
        "Host": "sentry.io",
        "Content-Length": "27",
        PROXY_OI_HEADER: "12",
        PROXY_SIGNATURE_HEADER: "-leander(but-in-cursive)",
        "X-Test-Header-1": "One",
        "X-Test-Header-2": "Two",
        "X-Test-Header-3": "Three",
    }
    secret = "hush-hush-im-invisible"

    def test_trim_leading_slashes(self):
        assert trim_leading_slashes("/happy-path") == "happy-path"
        assert trim_leading_slashes("/a/bit/nested") == "a/bit/nested"
        assert trim_leading_slashes("/////way-nested") == "way-nested"
        assert trim_leading_slashes("/") == "/"
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

    @override_settings(SENTRY_SUBNET_SECRET=secret)
    def test_subnet_signature(self):
        signature = "v0=62fdc170230e97426d868cb0c2ade132e05c9133af1cb28f323c6331436429e1"
        encode_kwargs = {
            "secret": self.secret,
            "path": "/chat.postMessage",
            "identifier": "21",
            "request_body": b'{"some": "payload"}',
        }
        verify_kwargs = {
            "path": encode_kwargs["path"],
            "identifier": encode_kwargs["identifier"],
            "request_body": encode_kwargs["request_body"],
            "provided_signature": signature,
        }
        assert encode_subnet_signature(**encode_kwargs) == signature
        assert verify_subnet_signature(**verify_kwargs)

        # We trim slashes prior to encoding/verifying
        slash_ignored_path_encode = {**encode_kwargs, "path": "chat.postMessage"}
        assert encode_subnet_signature(**slash_ignored_path_encode) == signature
        slash_ignored_path_verify = {**verify_kwargs, "path": "chat.postMessage"}
        assert verify_subnet_signature(**slash_ignored_path_verify)

        # Wrong secrets not be verifiable
        wrong_secret_encode = {**encode_kwargs, "secret": "wrong-secret"}
        wrong_secret_signature = encode_subnet_signature(**wrong_secret_encode)
        assert wrong_secret_signature != signature
        wrong_secret_verify = {**verify_kwargs, "provided_signature": wrong_secret_signature}
        assert not verify_subnet_signature(**wrong_secret_verify)

        # Any mishandled field should not be verifiable
        for kwarg in ["path", "identifier", "request_body"]:
            modified_encode = {**encode_kwargs, kwarg: "incorrect-data"}
            modified_verify = {**verify_kwargs, kwarg: "incorrect-data"}
            if kwarg == "request_body":
                modified_encode[kwarg] = b"incorrect-data"
                modified_verify[kwarg] = b"incorrect-data"
            assert encode_subnet_signature(**modified_encode) != signature
            assert not verify_subnet_signature(**modified_verify)
