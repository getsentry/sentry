from __future__ import absolute_import

from django.http import HttpRequest
from rest_framework.exceptions import AuthenticationFailed

from sentry.api.authentication import ClientIdSecretAuthentication
from sentry.mediators.sentry_apps import Creator
from sentry.testutils import TestCase


class TestClientIdSecretAuthentication(TestCase):
    def setUp(self):
        super(TestClientIdSecretAuthentication, self).setUp()

        self.auth = ClientIdSecretAuthentication()
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = Creator.run(
            name="foo",
            organization=self.org,
            scopes=(),
            webhook_url='https://example.com',
        )

        self.api_app = self.sentry_app.application

    def test_authenticate(self):
        request = HttpRequest()
        request.json_body = {
            'client_id': self.api_app.client_id,
            'client_secret': self.api_app.client_secret,
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
        request.json_body = {
            'client_secret': self.api_app.client_secret,
        }

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_missing_client_secret(self):
        request = HttpRequest()
        request.json_body = {
            'client_id': self.api_app.client_id,
        }

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_id(self):
        request = HttpRequest()
        request.json_body = {
            'client_id': 'notit',
            'client_secret': self.api_app.client_secret,
        }

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_secret(self):
        request = HttpRequest()
        request.json_body = {
            'client_id': self.api_app.client_id,
            'client_secret': 'notit',
        }

        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)
