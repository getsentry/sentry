# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.compat import mock
import unittest

from exam import fixture
from django.http import HttpRequest

from sentry import options
from sentry.models import Project
from sentry.testutils import TestCase
from sentry.utils.http import (
    is_same_domain,
    is_valid_origin,
    get_origins,
    absolute_uri,
    origin_from_request,
    heuristic_decode,
)


class AbsoluteUriTest(unittest.TestCase):
    def test_without_path(self):
        assert absolute_uri() == options.get("system.url-prefix")

    def test_with_path(self):
        assert absolute_uri("/foo/bar") == "%s/foo/bar" % (options.get("system.url-prefix"),)


class SameDomainTestCase(unittest.TestCase):
    def test_is_same_domain(self):
        url1 = "http://example.com/foo/bar"
        url2 = "http://example.com/biz/baz"

        self.assertTrue(is_same_domain(url1, url2))

    def test_is_same_domain_diff_scheme(self):
        url1 = "https://example.com/foo/bar"
        url2 = "http://example.com/biz/baz"

        self.assertTrue(is_same_domain(url1, url2))

    def test_is_same_domain_diff_port(self):
        url1 = "http://example.com:80/foo/bar"
        url2 = "http://example.com:13/biz/baz"

        self.assertFalse(is_same_domain(url1, url2))


class GetOriginsTestCase(TestCase):
    def test_project_default(self):
        project = Project.objects.get()

        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(project)
            self.assertEquals(result, frozenset(["*"]))

    def test_project(self):
        project = Project.objects.get()
        project.update_option("sentry:origins", [u"http://foo.example"])

        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(project)
            self.assertEquals(result, frozenset(["http://foo.example"]))

    def test_project_and_setting(self):
        project = Project.objects.get()
        project.update_option("sentry:origins", [u"http://foo.example"])

        with self.settings(SENTRY_ALLOW_ORIGIN="http://example.com"):
            result = get_origins(project)
            self.assertEquals(result, frozenset(["http://foo.example", "http://example.com"]))

    def test_setting_empty(self):
        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(None)
            self.assertEquals(result, frozenset([]))

    def test_setting_all(self):
        with self.settings(SENTRY_ALLOW_ORIGIN="*"):
            result = get_origins(None)
            self.assertEquals(result, frozenset(["*"]))

    def test_setting_uri(self):
        with self.settings(SENTRY_ALLOW_ORIGIN="http://example.com"):
            result = get_origins(None)
            self.assertEquals(result, frozenset(["http://example.com"]))

    def test_empty_origin_values(self):
        project = Project.objects.get()
        project.update_option("sentry:origins", [u"*", None, ""])

        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(project)
            self.assertEquals(result, frozenset([u"*"]))


class IsValidOriginTestCase(unittest.TestCase):
    @fixture
    def project(self):
        return mock.Mock()

    def isValidOrigin(self, origin, inputs):
        with mock.patch("sentry.utils.http.get_origins") as get_origins:
            get_origins.return_value = inputs
            result = is_valid_origin(origin, self.project)
            get_origins.assert_called_once_with(self.project)
        return result

    def test_global_wildcard_matches_domain(self):
        result = self.isValidOrigin("http://example.com", ["*"])
        self.assertEquals(result, True)

    def test_domain_wildcard_matches_domain(self):
        result = self.isValidOrigin("http://example.com", ["*.example.com"])
        self.assertEquals(result, True)

    def test_domain_wildcard_matches_domain_with_port(self):
        result = self.isValidOrigin("http://example.com:80", ["*.example.com"])
        self.assertEquals(result, True)

    def test_domain_wildcard_matches_subdomain(self):
        result = self.isValidOrigin("http://foo.example.com", ["*.example.com"])
        self.assertEquals(result, True)

    def test_domain_wildcard_matches_subdomain_with_port(self):
        result = self.isValidOrigin("http://foo.example.com:80", ["*.example.com"])
        self.assertEquals(result, True)

    def test_domain_wildcard_does_not_match_others(self):
        result = self.isValidOrigin("http://foo.com", ["*.example.com"])
        self.assertEquals(result, False)

    def test_domain_wildcard_matches_domain_with_path(self):
        result = self.isValidOrigin("http://foo.example.com/foo/bar", ["*.example.com"])
        self.assertEquals(result, True)

    def test_base_domain_matches_domain(self):
        result = self.isValidOrigin("http://example.com", ["example.com"])
        self.assertEquals(result, True)

    def test_base_domain_matches_domain_with_path(self):
        result = self.isValidOrigin("http://example.com/foo/bar", ["example.com"])
        self.assertEquals(result, True)

    def test_base_domain_matches_domain_with_port(self):
        result = self.isValidOrigin("http://example.com:80", ["example.com"])
        self.assertEquals(result, True)

    def test_base_domain_matches_domain_with_explicit_port(self):
        result = self.isValidOrigin("http://example.com:80", ["example.com:80"])
        assert result is True

    def test_base_domain_does_not_match_domain_with_invalid_port(self):
        result = self.isValidOrigin("http://example.com:80", ["example.com:443"])
        assert result is False

    def test_base_domain_does_not_match_subdomain(self):
        result = self.isValidOrigin("http://example.com", ["foo.example.com"])
        self.assertEquals(result, False)

    def test_full_uri_match(self):
        result = self.isValidOrigin("http://example.com", ["http://example.com"])
        self.assertEquals(result, True)

    def test_full_uri_match_requires_scheme(self):
        result = self.isValidOrigin("https://example.com", ["http://example.com"])
        self.assertEquals(result, False)

    def test_full_uri_match_does_not_require_port(self):
        result = self.isValidOrigin("http://example.com:80", ["http://example.com"])
        self.assertEquals(result, True)

    def test_partial_uri_match(self):
        result = self.isValidOrigin("http://example.com/foo/bar", ["http://example.com"])
        self.assertEquals(result, True)

    def test_null_valid_with_global(self):
        result = self.isValidOrigin("null", ["*"])
        self.assertEquals(result, True)

    def test_null_invalid_graceful_with_domains(self):
        result = self.isValidOrigin("null", ["http://example.com"])
        self.assertEquals(result, False)

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
        result = self.isValidOrigin(u"http://l\xf8calhost", [u"*.l\xf8calhost"])
        assert result is True

    def test_punycode(self):
        result = self.isValidOrigin("http://xn--lcalhost-54a", [u"*.l\xf8calhost"])
        assert result is True
        result = self.isValidOrigin("http://xn--lcalhost-54a", [u"*.xn--lcalhost-54a"])
        assert result is True
        result = self.isValidOrigin(u"http://l\xf8calhost", [u"*.xn--lcalhost-54a"])
        assert result is True
        result = self.isValidOrigin(b"http://l\xc3\xb8calhost", [u"*.xn--lcalhost-54a"])
        assert result is True
        result = self.isValidOrigin("http://xn--lcalhost-54a", [u"l\xf8calhost"])
        assert result is True
        result = self.isValidOrigin("http://xn--lcalhost-54a:80", [u"l\xf8calhost:80"])
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


class HeuristicDecodeTestCase(TestCase):
    json_body = '{"key": "value", "key2": "value2"}'
    url_body = "key=value&key2=value2"

    def test_json(self):
        data, content_type = heuristic_decode(self.json_body, "application/json")
        assert data == {"key": "value", "key2": "value2"}
        assert content_type == "application/json"

    def test_url_encoded(self):
        data, content_type = heuristic_decode(self.url_body, "application/x-www-form-urlencoded")
        assert data == {"key": ["value"], "key2": ["value2"]}
        assert content_type == "application/x-www-form-urlencoded"

    def test_possible_type_mismatch(self):
        data, content_type = heuristic_decode(self.json_body, "application/x-www-form-urlencoded")
        assert data == {"key": "value", "key2": "value2"}
        assert content_type == "application/json"

        data, content_type = heuristic_decode(self.url_body, "application/json")
        assert data == {"key": ["value"], "key2": ["value2"]}
        assert content_type == "application/x-www-form-urlencoded"

    def test_no_possible_type(self):
        data, content_type = heuristic_decode(self.json_body)
        assert data == {"key": "value", "key2": "value2"}
        assert content_type == "application/json"

    def test_unable_to_decode(self):
        data, content_type = heuristic_decode("string body", "text/plain")
        assert data == "string body"
        assert content_type == "text/plain"
