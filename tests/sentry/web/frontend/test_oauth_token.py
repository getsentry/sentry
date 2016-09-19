from __future__ import absolute_import

import six

from django.utils import timezone
from exam import fixture

from sentry.models import ApiApplication, ApiGrant, ApiToken
from sentry.testutils import TestCase
from sentry.utils import json


class OAuthTokenCodeTest(TestCase):
    @fixture
    def path(self):
        return '/oauth/token/'

    def setUp(self):
        super(OAuthTokenCodeTest, self).setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris='https://example.com',
        )
        self.grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri='https://example.com',
        )

    def test_no_get(self):
        self.login_as(self.user)

        resp = self.client.get(self.path)

        assert resp.status_code == 405

    def test_missing_grant_type(self):
        self.login_as(self.user)

        resp = self.client.post(self.path)

        assert resp.status_code == 400
        assert json.loads(resp.content) == {'error': 'unsupported_grant_type'}

    def test_invalid_grant_type(self):
        self.login_as(self.user)

        resp = self.client.post('{}?grant_type=foo'.format(
            self.path,
            'https://example.com',
            self.application.client_id,
        ))

        assert resp.status_code == 400
        assert json.loads(resp.content) == {'error': 'unsupported_grant_type'}

    def test_missing_client_id(self):
        self.login_as(self.user)

        resp = self.client.post('{}?grant_type=authorization_code&redirect_uri={}&code=abc'.format(
            self.path,
            'https://example.com',
        ))

        assert resp.status_code == 400
        assert json.loads(resp.content) == {'error': 'invalid_client'}

    def test_invalid_client_id(self):
        self.login_as(self.user)

        resp = self.client.post('{}?grant_type=authorization_code&redirect_uri={}&client_id=abc&code=abc'.format(
            self.path,
            'https://example.com',
        ))

        assert resp.status_code == 400
        assert json.loads(resp.content) == {'error': 'invalid_client'}

    def test_missing_code(self):
        self.login_as(self.user)

        resp = self.client.post('{}?grant_type=authorization_code&redirect_uri={}&client_id={}'.format(
            self.path,
            'https://example.com',
            self.application.client_id,
        ))

        assert resp.status_code == 400
        assert json.loads(resp.content) == {'error': 'invalid_grant'}

    def test_invalid_code(self):
        self.login_as(self.user)

        resp = self.client.post('{}?grant_type=authorization_code&redirect_uri={}&client_id={}&code=abc'.format(
            self.path,
            'https://example.com',
            self.application.client_id,
        ))
        assert resp.status_code == 400
        assert json.loads(resp.content) == {'error': 'invalid_grant'}

    def test_valid_params(self):
        self.login_as(self.user)

        resp = self.client.post('{}?grant_type=authorization_code&redirect_uri={}&code={}&client_id={}'.format(
            self.path,
            self.application.get_default_redirect_uri(),
            self.grant.code,
            self.application.client_id,
        ))

        assert resp.status_code == 200
        data = json.loads(resp.content)

        token = ApiToken.objects.get(token=data['access_token'])
        assert token.application == self.application
        assert token.user == self.grant.user
        assert token.scopes == self.grant.scopes

        assert data['access_token'] == token.token
        assert data['refresh_token'] == token.refresh_token
        assert data['expires_in']
        assert data['token_type'] == 'bearer'
        assert data['user'] == {'id': six.text_type(token.user_id)}


class OAuthTokenRefreshTokenTest(TestCase):
    @fixture
    def path(self):
        return '/oauth/token/'

    def setUp(self):
        super(OAuthTokenRefreshTokenTest, self).setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris='https://example.com',
        )
        self.grant = ApiGrant.objects.create(
            user=self.user,
            application=self.application,
            redirect_uri='https://example.com',
        )

    def test_missing_refresh_token(self):
        self.login_as(self.user)

        resp = self.client.post('{}?grant_type=refresh_token'.format(
            self.path,
            'https://example.com',
            self.application.client_id,
        ))

        assert resp.status_code == 400
        assert json.loads(resp.content) == {'error': 'invalid_grant'}

    def test_invalid_refresh_token(self):
        self.login_as(self.user)

        resp = self.client.post('{}?grant_type=refresh_token&refresh_token=foo'.format(
            self.path,
            'https://example.com',
            self.application.client_id,
        ))

        assert resp.status_code == 400
        assert json.loads(resp.content) == {'error': 'invalid_grant'}

    def test_valid_params(self):
        self.login_as(self.user)

        token = ApiToken.objects.create(
            application=self.application,
            user=self.user,
            expires_at=timezone.now(),
        )

        resp = self.client.post('{}?grant_type=refresh_token&refresh_token={}'.format(
            self.path,
            token.refresh_token,
        ))

        assert resp.status_code == 200

        token2 = ApiToken.objects.get(id=token.id)

        assert token2.application == token.application
        assert token2.user == token.user
        assert token2.scopes == token.scopes
        assert token2.expires_at > token.expires_at
        assert token2.token != token.token
        assert token2.refresh_token != token.refresh_token
        assert token2.refresh_token
