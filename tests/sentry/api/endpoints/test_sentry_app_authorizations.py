from __future__ import absolute_import

import six

from datetime import datetime, timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.mediators.sentry_apps import Creator as SentryAppCreator
from sentry.mediators.sentry_app_installations import Creator as \
    SentryAppInstallationCreator
from sentry.models import ApiApplication, ApiToken
from sentry.testutils import APITestCase


class TestSentryAppAuthorizations(APITestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.sentry_app = SentryAppCreator.run(
            name='nulldb',
            organization=self.create_organization(),
            scopes=('org:read', ),
            webhook_url='http://example.com',
        )

        self.other_sentry_app = SentryAppCreator.run(
            name='slowdb',
            organization=self.create_organization(),
            scopes=(),
            webhook_url='http://example.com',
        )

        self.install, self.grant = SentryAppInstallationCreator.run(
            organization=self.org,
            slug='nulldb',
            user=self.user,
        )

        self.url = reverse(
            'sentry-api-0-sentry-app-authorizations',
            args=[self.install.uuid],
        )

    def _run_request(self, *args, **kwargs):
        data = {
            'client_id': self.sentry_app.application.client_id,
            'client_secret': self.sentry_app.application.client_secret,
            'grant_type': 'authorization_code',
            'code': self.grant.code,
        }
        data.update(**kwargs)
        return self.client.post(self.url, data, headers={
            'Content-Type': 'application/json',
        })

    def test_exchanges_for_token_successfully(self):
        response = self._run_request()

        token = ApiToken.objects.get(
            application=self.sentry_app.application
        )

        assert response.status_code == 201, response.content
        assert response.data['scopes'] == self.sentry_app.scope_list
        assert response.data['token'] == token.token
        assert response.data['refreshToken'] == token.refresh_token

        expires_at = response.data['expiresAt'].replace(
            second=0,
            microsecond=0,
        )

        expected_expires_at = (datetime.now() + timedelta(hours=8)).replace(
            second=0,
            microsecond=0,
        )

        assert expires_at == expected_expires_at

    def test_incorrect_grant_type(self):
        response = self._run_request(grant_type='notit')
        assert response.status_code == 403

    def test_invalid_installation(self):
        self.install, _ = SentryAppInstallationCreator.run(
            organization=self.org,
            slug='slowdb',
            user=self.user,
        )

        # URL with this new Install's uuid in it
        self.url = reverse(
            'sentry-api-0-sentry-app-authorizations',
            args=[self.install.uuid],
        )

        response = self._run_request()
        assert response.status_code == 403

    def test_non_sentry_app_user(self):
        app = ApiApplication.objects.create(
            owner=self.create_user()
        )
        response = self._run_request(
            client_id=app.client_id,
            client_secret=app.client_secret,
        )
        assert response.status_code == 401

    def test_invalid_grant(self):
        response = self._run_request(code='123')
        assert response.status_code == 403

    def test_expired_grant(self):
        self.grant.update(expires_at=timezone.now() - timedelta(minutes=2))
        response = self._run_request()
        assert response.status_code == 403

    def test_request_with_exchanged_access_token(self):
        response = self._run_request()
        token = response.data['token']

        url = reverse(
            'sentry-api-0-organization-details',
            args=[self.org.slug],
        )

        response = self.client.get(
            url,
            HTTP_AUTHORIZATION='Bearer {}'.format(token),
        )

        assert response.status_code == 200
        assert response.data['id'] == six.binary_type(self.org.id)

    def test_state(self):
        response = self._run_request(state='abc123')
        assert response.data['state'] == 'abc123'
