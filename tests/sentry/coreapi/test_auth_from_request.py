from __future__ import absolute_import

from sentry.utils.compat import mock
import pytest

from django.core.exceptions import SuspiciousOperation

from sentry.coreapi import ClientAuthHelper, APIUnauthorized


def test_valid():
    helper = ClientAuthHelper()
    request = mock.Mock()
    request.META = {"HTTP_X_SENTRY_AUTH": "Sentry sentry_key=value, biz=baz"}
    request.GET = {}
    result = helper.auth_from_request(request)
    assert result.public_key == "value"


def test_valid_missing_space():
    helper = ClientAuthHelper()
    request = mock.Mock()
    request.META = {"HTTP_X_SENTRY_AUTH": "Sentry sentry_key=value,biz=baz"}
    request.GET = {}
    result = helper.auth_from_request(request)
    assert result.public_key == "value"


def test_valid_ignore_case():
    helper = ClientAuthHelper()
    request = mock.Mock()
    request.META = {"HTTP_X_SENTRY_AUTH": "SeNtRy sentry_key=value, biz=baz"}
    request.GET = {}
    result = helper.auth_from_request(request)
    assert result.public_key == "value"


def test_invalid_header_defers_to_GET():
    helper = ClientAuthHelper()
    request = mock.Mock()
    request.META = {"HTTP_X_SENTRY_AUTH": "foobar"}
    request.GET = {"sentry_version": "1", "foo": "bar"}
    result = helper.auth_from_request(request)
    assert result.version == "1"


def test_invalid_legacy_header_defers_to_GET():
    helper = ClientAuthHelper()
    request = mock.Mock()
    request.META = {"HTTP_AUTHORIZATION": "foobar"}
    request.GET = {"sentry_version": "1", "foo": "bar"}
    result = helper.auth_from_request(request)
    assert result.version == "1"


def test_invalid_header_bad_token():
    helper = ClientAuthHelper()
    request = mock.Mock()
    request.META = {"HTTP_X_SENTRY_AUTH": "Sentryfoo"}
    request.GET = {}
    with pytest.raises(APIUnauthorized):
        helper.auth_from_request(request)


def test_invalid_header_missing_pair():
    helper = ClientAuthHelper()
    request = mock.Mock()
    request.META = {"HTTP_X_SENTRY_AUTH": "Sentry foo"}
    request.GET = {}
    with pytest.raises(APIUnauthorized):
        helper.auth_from_request(request)


def test_invalid_malformed_value():
    helper = ClientAuthHelper()
    request = mock.Mock()
    request.META = {"HTTP_X_SENTRY_AUTH": "Sentry sentry_key=value,,biz=baz"}
    request.GET = {}
    with pytest.raises(APIUnauthorized):
        helper.auth_from_request(request)


def test_multiple_auth_suspicious():
    helper = ClientAuthHelper()
    request = mock.Mock()
    request.GET = {"sentry_version": "1", "foo": "bar"}
    request.META = {"HTTP_X_SENTRY_AUTH": "Sentry sentry_key=value, biz=baz"}
    with pytest.raises(SuspiciousOperation):
        helper.auth_from_request(request)
