# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from django.conf import settings
from django.core.urlresolvers import set_script_prefix, get_script_prefix
try:
    from django.core.handlers.wsgi import get_script_name
except ImportError:
    # django < 1.7
    from django.core.handlers.base import get_script_name

from exam import fixture

from sentry.models import Project
from sentry.testutils import TestCase
from sentry.utils.http import (
    is_same_domain,
    is_valid_origin,
    get_origins,
    absolute_uri
)


class Prefix(object):
    """
    Django test requests don't go through django.core.handlers.wsgi, which sets
    up the behaviour of `get_script_prefix`
    so we'll force the issue where needed as is done in `django.core.handlers.wsgi`
    during the normal request/response cycle.
    """
    def __init__(self, **environ):
        self.environ = environ
        self.oldprefix = get_script_prefix()

    def __enter__(self):
        set_script_prefix(get_script_name(self.environ))

    def __exit__(self, *args, **kwargs):
        set_script_prefix(self.oldprefix)


class AbsoluteUriTest(TestCase):
    """
    Given a path (possibly with a query/fragment part), absolute_uri creates a full url with
    scheme, domain and path parts based on the current sentry configuration.
    This honours the WSGI `SCRIPT_NAME` environment variable as per
    https://www.python.org/dev/peps/pep-0333/#id19 or the overridden
    ``django.conf.settings.FORCE_SCRIPT_NAME`` if given.

    These test go to some lengths to patch the test environment to set up the
    necessary WSGI environment using `Prefix` context manager to ensure the standard
    paths are reset at the end of the test run.

    In all cases, FORCE_SCRIPT_NAME should have the highest precedence.
    If FORCE_SCRIPT_NAME is present, it overrides SCRIPT_NAME.
    SCRIPT_NAME should be set by the WSGI server as all conforming implementations
    are required by the above spec.
    See Github #1122 for discussion.

    All tests for `SCRIPT_NAME` and `FORCE_SCRIPT_NAME` behaviour must use the
    `Prefix` context manager, otherwise django ignores any setting to that effect
    in the tests.
    """
    def test_without_path_bare(self):
        assert absolute_uri() == settings.SENTRY_URL_PREFIX

    def test_with_path_bare(self):
        assert absolute_uri('/foo/bar') == '%s/foo/bar' % settings.SENTRY_URL_PREFIX

    def test_without_path_wsgi(self):
        with Prefix():
            assert absolute_uri() == settings.SENTRY_URL_PREFIX

    def test_with_path_wsgi(self):
        with Prefix():
            assert absolute_uri('/foo/bar') == '%s/foo/bar' % settings.SENTRY_URL_PREFIX

    def test_with_force_script_name_without_path(self):
        with self.settings(
            FORCE_SCRIPT_NAME='/myforcescriptname',
            SENTRY_URL_PREFIX='http://example.com'
        ), Prefix():
            self.assertEqual(absolute_uri(), 'http://example.com/myforcescriptname')

    def test_with_force_script_name_with_path(self):
        with self.settings(
            FORCE_SCRIPT_NAME='/myforcescriptname',
            SENTRY_URL_PREFIX='http://example.com'
        ), Prefix():
            self.assertEqual(
                absolute_uri('/derp/derp/'), 'http://example.com/myforcescriptname/derp/derp/'
            )

    def test_with_script_name_without_path(self):
        with self.settings(
            SENTRY_URL_PREFIX='http://example.com'
        ), Prefix(SCRIPT_NAME='/myscriptname'):
                self.assertEqual(absolute_uri(), 'http://example.com/myscriptname')

    def test_with_script_name_with_path(self):
        with self.settings(
            SENTRY_URL_PREFIX='http://example.com'
        ), Prefix(SCRIPT_NAME='/myscriptname'):
            self.assertEqual(
                absolute_uri('/path/to/my/thing'),
                'http://example.com/myscriptname/path/to/my/thing'
            )

    def test_with_force_script_name_overrides_script_name(self):
        with self.settings(
            SENTRY_URL_PREFIX='http://example.com', FORCE_SCRIPT_NAME='/imincharge'
        ), Prefix(SCRIPT_NAME='/mywsgiscriptname'):
            self.assertEqual(absolute_uri(), 'http://example.com/imincharge')

    def test_with_force_script_name_overrides_script_name_path(self):
        with self.settings(
            SENTRY_URL_PREFIX='http://example.com', FORCE_SCRIPT_NAME='/imincharge'
        ), Prefix(SCRIPT_NAME='/mywsgiscriptname'):
            self.assertEqual(
                absolute_uri('/path/to/my/thing'),
                'http://example.com/imincharge/path/to/my/thing'
            )


class SameDomainTestCase(TestCase):
    def test_is_same_domain(self):
        url1 = 'http://example.com/foo/bar'
        url2 = 'http://example.com/biz/baz'

        self.assertTrue(is_same_domain(url1, url2))

    def test_is_same_domain_diff_scheme(self):
        url1 = 'https://example.com/foo/bar'
        url2 = 'http://example.com/biz/baz'

        self.assertTrue(is_same_domain(url1, url2))

    def test_is_same_domain_diff_port(self):
        url1 = 'http://example.com:80/foo/bar'
        url2 = 'http://example.com:13/biz/baz'

        self.assertFalse(is_same_domain(url1, url2))


class GetOriginsTestCase(TestCase):
    def test_project_default(self):
        project = Project.objects.get()

        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(project)
            self.assertEquals(result, frozenset(['*']))

    def test_project(self):
        project = Project.objects.get()
        project.update_option('sentry:origins', ['http://foo.example'])

        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(project)
            self.assertEquals(result, frozenset(['http://foo.example']))

    def test_project_and_setting(self):
        project = Project.objects.get()
        project.update_option('sentry:origins', ['http://foo.example'])

        with self.settings(SENTRY_ALLOW_ORIGIN='http://example.com'):
            result = get_origins(project)
            self.assertEquals(result, frozenset(['http://foo.example', 'http://example.com']))

    def test_setting_empty(self):
        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            result = get_origins(None)
            self.assertEquals(result, frozenset([]))

    def test_setting_all(self):
        with self.settings(SENTRY_ALLOW_ORIGIN='*'):
            result = get_origins(None)
            self.assertEquals(result, frozenset(['*']))

    def test_setting_uri(self):
        with self.settings(SENTRY_ALLOW_ORIGIN='http://example.com'):
            result = get_origins(None)
            self.assertEquals(result, frozenset(['http://example.com']))


class IsValidOriginTestCase(TestCase):
    @fixture
    def project(self):
        return mock.Mock()

    def isValidOrigin(self, origin, inputs):
        with mock.patch('sentry.utils.http.get_origins') as get_origins:
            get_origins.return_value = inputs
            result = is_valid_origin(origin, self.project)
            get_origins.assert_called_once_with(self.project)
        return result

    def test_global_wildcard_matches_domain(self):
        result = self.isValidOrigin('http://example.com', ['*'])
        self.assertEquals(result, True)

    def test_domain_wildcard_matches_domain(self):
        result = self.isValidOrigin('http://example.com', ['*.example.com'])
        self.assertEquals(result, True)

    def test_domain_wildcard_matches_domain_with_port(self):
        result = self.isValidOrigin('http://example.com:80', ['*.example.com'])
        self.assertEquals(result, True)

    def test_domain_wildcard_matches_subdomain(self):
        result = self.isValidOrigin('http://foo.example.com', ['*.example.com'])
        self.assertEquals(result, True)

    def test_domain_wildcard_matches_subdomain_with_port(self):
        result = self.isValidOrigin('http://foo.example.com:80', ['*.example.com'])
        self.assertEquals(result, True)

    def test_domain_wildcard_does_not_match_others(self):
        result = self.isValidOrigin('http://foo.com', ['*.example.com'])
        self.assertEquals(result, False)

    def test_domain_wildcard_matches_domain_with_path(self):
        result = self.isValidOrigin('http://foo.example.com/foo/bar', ['*.example.com'])
        self.assertEquals(result, True)

    def test_base_domain_matches_domain(self):
        result = self.isValidOrigin('http://example.com', ['example.com'])
        self.assertEquals(result, True)

    def test_base_domain_matches_domain_with_path(self):
        result = self.isValidOrigin('http://example.com/foo/bar', ['example.com'])
        self.assertEquals(result, True)

    def test_base_domain_matches_domain_with_port(self):
        result = self.isValidOrigin('http://example.com:80', ['example.com'])
        self.assertEquals(result, True)

    def test_base_domain_matches_domain_with_explicit_port(self):
        result = self.isValidOrigin('http://example.com:80', ['example.com:80'])
        assert result is True

    def test_base_domain_does_not_match_domain_with_invalid_port(self):
        result = self.isValidOrigin('http://example.com:80', ['example.com:443'])
        assert result is False

    def test_base_domain_does_not_match_subdomain(self):
        result = self.isValidOrigin('http://example.com', ['foo.example.com'])
        self.assertEquals(result, False)

    def test_full_uri_match(self):
        result = self.isValidOrigin('http://example.com', ['http://example.com'])
        self.assertEquals(result, True)

    def test_full_uri_match_requires_scheme(self):
        result = self.isValidOrigin('https://example.com', ['http://example.com'])
        self.assertEquals(result, False)

    def test_full_uri_match_does_not_require_port(self):
        result = self.isValidOrigin('http://example.com:80', ['http://example.com'])
        self.assertEquals(result, True)

    def test_partial_uri_match(self):
        result = self.isValidOrigin('http://example.com/foo/bar', ['http://example.com'])
        self.assertEquals(result, True)

    def test_null_valid_with_global(self):
        result = self.isValidOrigin('null', ['*'])
        self.assertEquals(result, True)

    def test_null_invalid_graceful_with_domains(self):
        result = self.isValidOrigin('null', ['http://example.com'])
        self.assertEquals(result, False)

    def test_custom_protocol_with_location(self):
        result = self.isValidOrigin('sp://custom-thing/foo/bar', ['sp://custom-thing'])
        assert result is True

        result = self.isValidOrigin('sp://custom-thing-two/foo/bar', ['sp://custom-thing'])
        assert result is False

    def test_custom_protocol_without_location(self):
        result = self.isValidOrigin('sp://custom-thing/foo/bar', ['sp://*'])
        assert result is True

        result = self.isValidOrigin('dp://custom-thing/foo/bar', ['sp://'])
        assert result is False

    def test_custom_protocol_with_domainish_match(self):
        result = self.isValidOrigin('sp://custom-thing.foobar/foo/bar', ['sp://*.foobar'])
        assert result is True

        result = self.isValidOrigin('sp://custom-thing.bizbaz/foo/bar', ['sp://*.foobar'])
        assert result is False
