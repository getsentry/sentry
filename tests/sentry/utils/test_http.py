import unittest
from unittest import mock

from django.http import HttpRequest

from sentry import options
from sentry.testutils.cases import TestCase
from sentry.utils.http import absolute_uri, get_origins, is_valid_origin, origin_from_request


class AbsoluteUriTest(unittest.TestCase):
    def test_without_path(self):
        assert absolute_uri() == options.get("system.url-prefix")

    def test_override_url_prefix(self):
        assert absolute_uri("/foo/bar", url_prefix="http://foobar/") == "http://foobar/foo/bar"

    def test_with_path(self):
        assert absolute_uri("/foo/bar") == "{}/foo/bar".format(options.get("system.url-prefix"))

    def test_hostname_present(self):
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

    def test_project_default(self):
        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(self.project)
            self.assertEqual(result, frozenset(["*"]))

    def test_project(self):
        self.project.update_option("sentry:origins", ["http://foo.example"])

        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(self.project)
            self.assertEqual(result, frozenset(["http://foo.example"]))

    def test_project_and_setting(self):
        self.project.update_option("sentry:origins", ["http://foo.example"])

        with self.settings(SENTRY_ALLOW_ORIGIN="http://example.com"):
            result = get_origins(self.project)
            self.assertEqual(result, frozenset(["http://foo.example"]))

    def test_setting_empty(self):
        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(None)
            self.assertEqual(result, frozenset(["*"]))

    def test_setting_all(self):
        with self.settings(SENTRY_ALLOW_ORIGIN="*"):
            result = get_origins(None)
            self.assertEqual(result, frozenset(["*"]))

    def test_setting_uri(self):
        with self.settings(SENTRY_ALLOW_ORIGIN="http://example.com"):
            result = get_origins(None)
            self.assertEqual(result, frozenset(["http://example.com"]))

    def test_empty_origin_values(self):
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

    def test_global_wildcard_matches_domain(self):
        result = self.isValidOrigin("http://example.com", ["*"])
        self.assertEqual(result, True)

    def test_domain_wildcard_matches_domain(self):
        result = self.isValidOrigin("http://example.com", ["*.example.com"])
        self.assertEqual(result, True)

    def test_domain_wildcard_matches_domain_with_port(self):
        result = self.isValidOrigin("http://example.com:80", ["*.example.com"])
        self.assertEqual(result, True)

    def test_domain_wildcard_matches_subdomain(self):
        result = self.isValidOrigin("http://foo.example.com", ["*.example.com"])
        self.assertEqual(result, True)

    def test_domain_wildcard_matches_subdomain_with_port(self):
        result = self.isValidOrigin("http://foo.example.com:80", ["*.example.com"])
        self.assertEqual(result, True)

    def test_domain_wildcard_does_not_match_others(self):
        result = self.isValidOrigin("http://foo.com", ["*.example.com"])
        self.assertEqual(result, False)

    def test_domain_wildcard_matches_domain_with_path(self):
        result = self.isValidOrigin("http://foo.example.com/foo/bar", ["*.example.com"])
        self.assertEqual(result, True)

    def test_base_domain_matches_domain(self):
        result = self.isValidOrigin("http://example.com", ["example.com"])
        self.assertEqual(result, True)

    def test_base_domain_matches_domain_with_path(self):
        result = self.isValidOrigin("http://example.com/foo/bar", ["example.com"])
        self.assertEqual(result, True)

    def test_base_domain_matches_domain_with_port(self):
        result = self.isValidOrigin("http://example.com:80", ["example.com"])
        self.assertEqual(result, True)

    def test_base_domain_matches_domain_with_explicit_port(self):
        result = self.isValidOrigin("http://example.com:80", ["example.com:80"])
        assert result is True

    def test_base_domain_does_not_match_domain_with_invalid_port(self):
        result = self.isValidOrigin("http://example.com:80", ["example.com:443"])
        assert result is False

    def test_base_domain_does_not_match_subdomain(self):
        result = self.isValidOrigin("http://example.com", ["foo.example.com"])
        self.assertEqual(result, False)

    def test_full_uri_match(self):
        result = self.isValidOrigin("http://example.com", ["http://example.com"])
        self.assertEqual(result, True)

    def test_full_uri_match_requires_scheme(self):
        result = self.isValidOrigin("https://example.com", ["http://example.com"])
        self.assertEqual(result, False)

    def test_full_uri_match_does_not_require_port(self):
        result = self.isValidOrigin("http://example.com:80", ["http://example.com"])
        self.assertEqual(result, True)

    def test_partial_uri_match(self):
        result = self.isValidOrigin("http://example.com/foo/bar", ["http://example.com"])
        self.assertEqual(result, True)

    def test_null_valid_with_global(self):
        result = self.isValidOrigin("null", ["*"])
        self.assertEqual(result, True)

    def test_null_invalid_graceful_with_domains(self):
        result = self.isValidOrigin("null", ["http://example.com"])
        self.assertEqual(result, False)

    def test_custom_protocol_with_location(self):
        result = self.isValidOrigin("sp://custom-thing/foo/bar", ["sp://custom-thing"])
        assert result is True

        result = self.isValidOrigin("sp://custom-thing-two/foo/bar", ["sp://custom-thing"])
        assert result is False

    def test_custom_protocol_without_location(self):
        result = self.isValidOrigin("sp://custom-thing/foo/bar", ["sp://*"])
        assert result is True

        result = self.isValidOrigin("dp://custom-thing/foo/bar", ["sp://"])
        assert result is False

    def test_custom_protocol_with_domainish_match(self):
        result = self.isValidOrigin("sp://custom-thing.foobar/foo/bar", ["sp://*.foobar"])
        assert result is True

        result = self.isValidOrigin("sp://custom-thing.bizbaz/foo/bar", ["sp://*.foobar"])
        assert result is False

    def test_unicode(self):
        result = self.isValidOrigin("http://l\xf8calhost", ["*.l\xf8calhost"])
        assert result is True

    def test_punycode(self):
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

    def test_unparseable_uri(self):
        result = self.isValidOrigin("http://example.com", ["."])
        assert result is False

    def test_wildcard_hostname_with_port(self):
        result = self.isValidOrigin("http://example.com:1234", ["*:1234"])
        assert result is True

    def test_without_hostname(self):
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
    def test_nothing(self):
        request = HttpRequest()
        assert origin_from_request(request) is None

    def test_origin(self):
        request = HttpRequest()
        request.META["HTTP_ORIGIN"] = "http://example.com"
        request.META["HTTP_REFERER"] = "nope"
        assert origin_from_request(request) == "http://example.com"

    def test_referer(self):
        request = HttpRequest()
        request.META["HTTP_REFERER"] = "http://example.com/foo/bar"
        assert origin_from_request(request) == "http://example.com"

    def test_null_origin(self):
        request = HttpRequest()
        request.META["HTTP_ORIGIN"] = "null"
        assert origin_from_request(request) is None

        request.META["HTTP_REFERER"] = "http://example.com"
        assert origin_from_request(request) == "http://example.com"
