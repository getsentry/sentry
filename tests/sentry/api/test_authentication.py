from __future__ import absolute_import

import pytest

from django.http import HttpRequest
from rest_framework.exceptions import AuthenticationFailed

from sentry.api.authentication import ClientIdSecretAuthentication, DSNAuthentication
from sentry.models import ProjectKeyStatus
from sentry.testutils import TestCase


class TestClientIdSecretAuthentication(TestCase):
    def setUp(self):
        super(TestClientIdSecretAuthentication, self).setUp()

        self.auth = ClientIdSecretAuthentication()
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.org)

        self.api_app = self.sentry_app.application

    def test_authenticate(self):
        request = HttpRequest()
        request.json_body = {
            "client_id": self.api_app.client_id,
            "client_secret": self.api_app.client_secret,
        }

        user, _ = self.auth.authenticate(request)

        assert user == self.sentry_app.proxy_user

    def test_without_json_body(self):
        request = HttpRequest()
        request.json_body = None

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_missing_client_id(self):
        request = HttpRequest()
        request.json_body = {"client_secret": self.api_app.client_secret}

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_missing_client_secret(self):
        request = HttpRequest()
        request.json_body = {"client_id": self.api_app.client_id}

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_id(self):
        request = HttpRequest()
        request.json_body = {"client_id": "notit", "client_secret": self.api_app.client_secret}

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_secret(self):
        request = HttpRequest()
        request.json_body = {"client_id": self.api_app.client_id, "client_secret": "notit"}

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)


class TestDSNAuthentication(TestCase):
    def setUp(self):
        super(TestDSNAuthentication, self).setUp()

        self.auth = DSNAuthentication()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.project_key = self.create_project_key(project=self.project)

    def test_authenticate(self):
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = u"DSN {}".format(self.project_key.dsn_public)

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous()
        assert auth == self.project_key

    def test_inactive_key(self):
        self.project_key.update(status=ProjectKeyStatus.INACTIVE)
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = u"DSN {}".format(self.project_key.dsn_public)

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)
