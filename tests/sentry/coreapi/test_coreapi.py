# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six
import pytest

from sentry.coreapi import (
    APIError,
    APIUnauthorized,
    Auth,
    ClientApiHelper,
    ClientAuthHelper,
    decode_data,
    safely_load_json_string,
)
from sentry.interfaces.base import get_interface
from sentry.testutils import TestCase


class BaseAPITest(TestCase):
    auth_helper_cls = ClientAuthHelper

    def setUp(self):
        self.user = self.create_user("coreapi@example.com")
        self.team = self.create_team(name="Foo")
        self.project = self.create_project(teams=[self.team])
        self.pk = self.project.key_set.get_or_create()[0]
        self.helper = ClientApiHelper(agent="Awesome Browser", ip_address="198.51.100.0")


class ProjectIdFromAuthTest(BaseAPITest):
    def test_invalid_if_missing_key(self):
        with pytest.raises(APIUnauthorized):
            self.helper.project_id_from_auth(Auth())

    def test_valid_with_key(self):
        auth = Auth(public_key=self.pk.public_key)
        result = self.helper.project_id_from_auth(auth)
        assert result == self.project.id

    def test_invalid_key(self):
        auth = Auth(public_key="z")
        with pytest.raises(APIUnauthorized):
            self.helper.project_id_from_auth(auth)

    def test_invalid_secret(self):
        auth = Auth(public_key=self.pk.public_key, secret_key="z")
        with pytest.raises(APIUnauthorized):
            self.helper.project_id_from_auth(auth)

    def test_nonascii_key(self):
        auth = Auth(public_key="\xc3\xbc")
        with pytest.raises(APIUnauthorized):
            self.helper.project_id_from_auth(auth)


def test_safely_load_json_string_valid_payload():
    data = safely_load_json_string('{"foo": "bar"}')
    assert data == {"foo": "bar"}


def test_safely_load_json_string_invalid_json():
    with pytest.raises(APIError):
        safely_load_json_string("{")


def test_safely_load_json_string_unexpected_type():
    with pytest.raises(APIError):
        safely_load_json_string("1")


def test_valid_data():
    data = decode_data("foo")
    assert data == u"foo"
    assert isinstance(data, six.text_type)


def test_invalid_data():
    with pytest.raises(APIError):
        decode_data("\x99")


def test_get_interface_does_not_let_through_disallowed_name():
    with pytest.raises(ValueError):
        get_interface("subprocess")


def test_get_interface_allows_http():
    from sentry.interfaces.http import Http

    result = get_interface("request")
    assert result is Http
    result = get_interface("request")
    assert result is Http
