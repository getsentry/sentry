from __future__ import absolute_import

from datetime import datetime, timedelta

from sentry.coreapi import APIUnauthorized
from sentry.mediators.sentry_apps import Creator as SentryAppCreator
from sentry.mediators.sentry_app_installations import Authorizer, Creator
from sentry.testutils import TestCase


class TestAuthorizer(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.sentry_app = SentryAppCreator.run(
            name='nulldb',
            organization=self.org,
            scopes=(),
            webhook_url='http://example.com',
        )

        self.install, self.grant = Creator.run(
            organization=self.org,
            slug='nulldb',
        )

        self.authorizer = Authorizer(
            install=self.install,
            grant_type='authorization_code',
            code=self.grant.code,
            client_id=self.sentry_app.application.client_id,
            user=self.sentry_app.proxy_user,
        )

    def test_simple(self):
        token = self.authorizer.call()
        assert token is not None

    def test_token_expires_in_eight_hours(self):
        token = self.authorizer.call()
        assert token.expires_at.hour == (datetime.now() + timedelta(hours=8)).hour

    def test_invalid_grant_type(self):
        self.authorizer.grant_type = 'stuff'

        with self.assertRaises(APIUnauthorized):
            self.authorizer.call()

    def test_non_owner(self):
        self.authorizer.user = self.create_user(is_sentry_app=True)

        with self.assertRaises(APIUnauthorized):
            self.authorizer.call()

    def test_non_sentry_app(self):
        self.authorizer.user = self.create_user()

        with self.assertRaises(APIUnauthorized):
            self.authorizer.call()

    def test_missing_grant(self):
        self.authorizer.code = '123'

        with self.assertRaises(APIUnauthorized):
            self.authorizer.call()

    def test_mismatching_client_id(self):
        self.authorizer.client_id = '123'

        with self.assertRaises(APIUnauthorized):
            self.authorizer.call()
