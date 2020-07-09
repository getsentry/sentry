# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.coreapi import (
    APIUnauthorized,
    Auth,
    ClientApiHelper,
)
from sentry.interfaces.base import get_interface
from sentry.testutils import TestCase


class BaseAPITest(TestCase):
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


def test_get_interface_does_not_let_through_disallowed_name():
    with pytest.raises(ValueError):
        get_interface("subprocess")


def test_get_interface_allows_http():
    from sentry.interfaces.http import Http

    result = get_interface("request")
    assert result is Http
    result = get_interface("request")
    assert result is Http
