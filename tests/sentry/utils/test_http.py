import io
import unittest
from collections.abc import Generator
from unittest import mock

import pytest
from django.core.handlers.wsgi import LimitedStream
from django.http import HttpRequest
from django.test import RequestFactory

from sentry import options
from sentry.testutils.cases import TestCase
from sentry.utils.http import (
    BodyWithLength,
    ChunkedEncodingDecoder,
    absolute_uri,
    get_origins,
    is_valid_ip,
    is_valid_origin,
    origin_from_request,
    request_body_stream,
)


class AbsoluteUriTest(unittest.TestCase):
    def test_without_path(self) -> None:
        assert absolute_uri() == options.get("system.url-prefix")

    def test_override_url_prefix(self) -> None:
        assert absolute_uri("/foo/bar", url_prefix="http://foobar/") == "http://foobar/foo/bar"

    def test_with_path(self) -> None:
        assert absolute_uri("/foo/bar") == "{}/foo/bar".format(options.get("system.url-prefix"))

    def test_hostname_present(self) -> None:
        assert (
            absolute_uri("https://orgslug.sentry.io/foo/bar") == "https://orgslug.sentry.io/foo/bar"
        )
        assert (
            absolute_uri("https://orgslug.sentry.io/foo/bar", url_prefix="http://foobar/")
            == "https://orgslug.sentry.io/foo/bar"
        )


class GetOriginsTestCase(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()

    def test_project_default(self) -> None:
        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(self.project)
            self.assertEqual(result, frozenset(["*"]))

    def test_project(self) -> None:
        self.project.update_option("sentry:origins", ["http://foo.example"])

        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(self.project)
            self.assertEqual(result, frozenset(["http://foo.example"]))

    def test_project_and_setting(self) -> None:
        self.project.update_option("sentry:origins", ["http://foo.example"])

        with self.settings(SENTRY_ALLOW_ORIGIN="http://example.com"):
            result = get_origins(self.project)
            self.assertEqual(result, frozenset(["http://foo.example"]))

    def test_setting_empty(self) -> None:
        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(None)
            self.assertEqual(result, frozenset(["*"]))

    def test_setting_all(self) -> None:
        with self.settings(SENTRY_ALLOW_ORIGIN="*"):
            result = get_origins(None)
            self.assertEqual(result, frozenset(["*"]))

    def test_setting_uri(self) -> None:
        with self.settings(SENTRY_ALLOW_ORIGIN="http://example.com"):
            result = get_origins(None)
            self.assertEqual(result, frozenset(["http://example.com"]))

    def test_empty_origin_values(self) -> None:
        self.project.update_option("sentry:origins", ["*", None, ""])

        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(self.project)
            self.assertEqual(result, frozenset(["*"]))


class IsValidOriginTestCase(unittest.TestCase):
    def isValidOrigin(self, origin, inputs):
        with mock.patch("sentry.utils.http.get_origins") as get_origins:
            get_origins.return_value = inputs
            project = mock.Mock()
            result = is_valid_origin(origin, project)
            get_origins.assert_called_once_with(project)
        return result

    def test_global_wildcard_matches_domain(self) -> None:
        result = self.isValidOrigin("http://example.com", ["*"])
        self.assertEqual(result, True)

    def test_domain_wildcard_matches_domain(self) -> None:
        result = self.isValidOrigin("http://example.com", ["*.example.com"])
        self.assertEqual(result, True)

    def test_domain_wildcard_matches_domain_with_port(self) -> None:
        result = self.isValidOrigin("http://example.com:80", ["*.example.com"])
        self.assertEqual(result, True)

    def test_domain_wildcard_matches_subdomain(self) -> None:
        result = self.isValidOrigin("http://foo.example.com", ["*.example.com"])
        self.assertEqual(result, True)

    def test_domain_wildcard_matches_subdomain_with_port(self) -> None:
        result = self.isValidOrigin("http://foo.example.com:80", ["*.example.com"])
        self.assertEqual(result, True)

    def test_domain_wildcard_does_not_match_others(self) -> None:
        result = self.isValidOrigin("http://foo.com", ["*.example.com"])
        self.assertEqual(result, False)

    def test_domain_wildcard_matches_domain_with_path(self) -> None:
        result = self.isValidOrigin("http://foo.example.com/foo/bar", ["*.example.com"])
        self.assertEqual(result, True)

    def test_base_domain_matches_domain(self) -> None:
        result = self.isValidOrigin("http://example.com", ["example.com"])
        self.assertEqual(result, True)

    def test_base_domain_matches_domain_with_path(self) -> None:
        result = self.isValidOrigin("http://example.com/foo/bar", ["example.com"])
        self.assertEqual(result, True)

    def test_base_domain_matches_domain_with_port(self) -> None:
        result = self.isValidOrigin("http://example.com:80", ["example.com"])
        self.assertEqual(result, True)

    def test_base_domain_matches_domain_with_explicit_port(self) -> None:
        result = self.isValidOrigin("http://example.com:80", ["example.com:80"])
        assert result is True

    def test_base_domain_does_not_match_domain_with_invalid_port(self) -> None:
        result = self.isValidOrigin("http://example.com:80", ["example.com:443"])
        assert result is False

    def test_base_domain_does_not_match_subdomain(self) -> None:
        result = self.isValidOrigin("http://example.com", ["foo.example.com"])
        self.assertEqual(result, False)

    def test_full_uri_match(self) -> None:
        result = self.isValidOrigin("http://example.com", ["http://example.com"])
        self.assertEqual(result, True)

    def test_full_uri_match_requires_scheme(self) -> None:
        result = self.isValidOrigin("https://example.com", ["http://example.com"])
        self.assertEqual(result, False)

    def test_full_uri_match_does_not_require_port(self) -> None:
        result = self.isValidOrigin("http://example.com:80", ["http://example.com"])
        self.assertEqual(result, True)

    def test_partial_uri_match(self) -> None:
        result = self.isValidOrigin("http://example.com/foo/bar", ["http://example.com"])
        self.assertEqual(result, True)

    def test_null_valid_with_global(self) -> None:
        result = self.isValidOrigin("null", ["*"])
        self.assertEqual(result, True)

    def test_null_invalid_graceful_with_domains(self) -> None:
        result = self.isValidOrigin("null", ["http://example.com"])
        self.assertEqual(result, False)

    def test_custom_protocol_with_location(self) -> None:
        result = self.isValidOrigin("sp://custom-thing/foo/bar", ["sp://custom-thing"])
        assert result is True

        result = self.isValidOrigin("sp://custom-thing-two/foo/bar", ["sp://custom-thing"])
        assert result is False

    def test_custom_protocol_without_location(self) -> None:
        result = self.isValidOrigin("sp://custom-thing/foo/bar", ["sp://*"])
        assert result is True

        result = self.isValidOrigin("dp://custom-thing/foo/bar", ["sp://"])
        assert result is False

    def test_custom_protocol_with_domainish_match(self) -> None:
        result = self.isValidOrigin("sp://custom-thing.foobar/foo/bar", ["sp://*.foobar"])
        assert result is True

        result = self.isValidOrigin("sp://custom-thing.bizbaz/foo/bar", ["sp://*.foobar"])
        assert result is False

    def test_unicode(self) -> None:
        result = self.isValidOrigin("http://l\xf8calhost", ["*.l\xf8calhost"])
        assert result is True

    def test_punycode(self) -> None:
        result = self.isValidOrigin("http://xn--lcalhost-54a", ["*.l\xf8calhost"])
        assert result is True
        result = self.isValidOrigin("http://xn--lcalhost-54a", ["*.xn--lcalhost-54a"])
        assert result is True
        result = self.isValidOrigin("http://l\xf8calhost", ["*.xn--lcalhost-54a"])
        assert result is True
        result = self.isValidOrigin("http://xn--lcalhost-54a", ["l\xf8calhost"])
        assert result is True
        result = self.isValidOrigin("http://xn--lcalhost-54a:80", ["l\xf8calhost:80"])
        assert result is True

    def test_unparseable_uri(self) -> None:
        result = self.isValidOrigin("http://example.com", ["."])
        assert result is False

    def test_wildcard_hostname_with_port(self) -> None:
        result = self.isValidOrigin("http://example.com:1234", ["*:1234"])
        assert result is True

    def test_without_hostname(self) -> None:
        result = self.isValidOrigin("foo://", ["foo://*"])
        assert result is True
        result = self.isValidOrigin("foo://", ["foo://"])
        assert result is True
        result = self.isValidOrigin("foo://", ["example.com"])
        assert result is False
        result = self.isValidOrigin("foo://a", ["foo://"])
        assert result is False
        result = self.isValidOrigin("foo://a", ["foo://*"])
        assert result is True


class OriginFromRequestTestCase(TestCase):
    def test_nothing(self) -> None:
        request = HttpRequest()
        assert origin_from_request(request) is None

    def test_origin(self) -> None:
        request = HttpRequest()
        request.META["HTTP_ORIGIN"] = "http://example.com"
        request.META["HTTP_REFERER"] = "nope"
        assert origin_from_request(request) == "http://example.com"

    def test_referer(self) -> None:
        request = HttpRequest()
        request.META["HTTP_REFERER"] = "http://example.com/foo/bar"
        assert origin_from_request(request) == "http://example.com"

    def test_null_origin(self) -> None:
        request = HttpRequest()
        request.META["HTTP_ORIGIN"] = "null"
        assert origin_from_request(request) is None

        request.META["HTTP_REFERER"] = "http://example.com"
        assert origin_from_request(request) == "http://example.com"


class TestIsValidIP:
    ip_test_cases = [
        # Adapted from grouping parameterization tests
        # (name, input, expected result)
        ("IPv4", "11.21.12.31", True),
        ("IPv6 unspecified", "::", True),
        ("IPv6 loopback", "::1", True),
        ("IPv6 ULA", "fc00::/7", True),
        ("IPv6 initial compressed segment", "::cbe:908:2013", True),
        ("IPv6 compressed segment in middle", "2012:d157::cbe:908:2013", True),
        ("IPv6 final compressed segment", "2012:d157::", True),
        ("IPv4 mapped to v6", "::ffff:192.168.1.1", True),
        ("IPv6 full", "1121:0c03:1231:130d:0000:16da:0908:da07", True),
        ("IPv4 too few segments", "12:31:99", False),
        ("IPv4 too many segments", "11.21.12.31.12", False),
        ("IPv4 segment > 255", "12.31.12.908", False),
        ("IPv4 leading zeros", "11.21.12.001", False),
        ("double colon object property", "Option::unwrap()", False),
        ("double colon object property including hex", "Bee::buzz()", False),
        ("too many initial characters", "12345::6:789", False),
        ("too many final characters", "123:4::56789", False),
        ("too many initial colons", ":::1121", False),
        ("too many interior colons", "1231:::1121", False),
        ("too many final colons", "1231:::", False),
        ("three colons alone", ":::", False),
        ("single leading colon", "Script error. :0:0", False),
        ("already parameterized", "ip", False),
        ("filtering placeholder", "Filtered", False),
        ("filtering placeholder with type", "redacted_number", False),
        ("random non-IP value", "dogs_are_great", False),
    ]

    @pytest.mark.parametrize(("name", "input", "expected_result"), ip_test_cases)
    def test_is_valid_ip(self, name: str, input: str, expected_result: bool) -> None:
        assert is_valid_ip(input) == expected_result


class TestChunkedEncodingDecoder:
    def test_reads_all_chunks(self) -> None:
        decoder = ChunkedEncodingDecoder(io.BytesIO(b"3\r\nabc\r\n2\r\nde\r\n0\r\n\r\n").read)

        assert decoder.read() == b"abcde"
        assert decoder.read() == b""

    def test_reads_sizes_across_chunk_boundaries(self) -> None:
        decoder = ChunkedEncodingDecoder(io.BytesIO(b"3\r\nabc\r\n2\r\nde\r\n0\r\n\r\n").read)

        assert decoder.read(2) == b"ab"
        assert decoder.read(2) == b"cd"
        assert decoder.read(2) == b"e"
        assert decoder.read(2) == b""

    def test_rejects_missing_chunk_terminator(self) -> None:
        decoder = ChunkedEncodingDecoder(io.BytesIO(b"3\r\nabcXX0\r\n\r\n").read)

        with pytest.raises(ValueError, match="Malformed chunk encoded stream"):
            decoder.read()

    def test_rejects_stream_ending_mid_chunk(self) -> None:
        decoder = ChunkedEncodingDecoder(io.BytesIO(b"5\r\nab").read)

        with pytest.raises(ValueError, match="Unexpected end of stream"):
            decoder.read()


class TestRequestBodyStream:
    def test_returns_content_length_body(self) -> None:
        request = RequestFactory().put(
            "/", data=b"payload", content_type="application/octet-stream"
        )

        assert request_body_stream(request) == b"payload"

    def test_granian_returns_wsgi_input_for_chunked_body(self) -> None:
        wsgi_input = io.BytesIO(b"payload")
        request = RequestFactory().generic(
            "PUT", "/", SERVER_SOFTWARE="granian", HTTP_TRANSFER_ENCODING="chunked"
        )
        request.META["wsgi.input"] = wsgi_input

        assert request_body_stream(request) is wsgi_input

    def test_dev_server_decodes_chunked_body(self) -> None:
        request = RequestFactory().generic("POST", "/", HTTP_TRANSFER_ENCODING="chunked")
        # The dev server bounds its socket by Content-Length, which a chunked request lacks.
        request.META["wsgi.input"] = LimitedStream(io.BytesIO(b"7\r\npayload\r\n0\r\n\r\n"), 0)

        stream = request_body_stream(request)

        assert isinstance(stream, ChunkedEncodingDecoder)
        assert stream.read() == b"payload"

    def test_dev_server_returns_nothing_for_bodiless_methods(self) -> None:
        request = RequestFactory().get("/")

        assert request_body_stream(request) is None

    def test_dev_server_wraps_empty_unchunked_body(self) -> None:
        request = RequestFactory().generic("POST", "/")

        assert isinstance(request_body_stream(request), BodyWithLength)

    def test_uwsgi_streams_chunked_body(self) -> None:
        request = RequestFactory().generic("POST", "/", HTTP_TRANSFER_ENCODING="chunked")

        with mock.patch("sentry.utils.http.uwsgi") as uwsgi:
            uwsgi.chunked_read.side_effect = [b"pay", b"load", b""]
            stream = request_body_stream(request)

            assert isinstance(stream, Generator)
            assert b"".join(stream) == b"payload"

    def test_uwsgi_returns_wsgi_input_for_unchunked_body(self) -> None:
        wsgi_input = io.BytesIO(b"")
        request = RequestFactory().generic("POST", "/")
        request.META["wsgi.input"] = wsgi_input

        with mock.patch("sentry.utils.http.uwsgi"):
            assert request_body_stream(request) is wsgi_input
