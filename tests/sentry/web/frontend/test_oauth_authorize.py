from __future__ import absolute_import

from exam import fixture
from six.moves.urllib.parse import parse_qs

from sentry.models import ApiApplication, ApiGrant, ApiGrantType, ApiToken
from sentry.testutils import TestCase


class OAuthAuthorizeCodeTest(TestCase):
    @fixture
    def path(self):
        return '/oauth/authorize/'

    def setUp(self):
        super(OAuthAuthorizeCodeTest, self).setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris='https://example.com',
            grant_type=ApiGrantType.authorization_code,
        )

    def test_missing_response_type(self):
        self.login_as(self.user)

        resp = self.client.get('{}?redirect_uri={}&client_id={}'.format(
            self.path,
            'https://example.com',
            self.application.client_id,
        ))

        assert resp.status_code == 302
        assert resp['Location'] == 'https://example.com?error=unsupported_response_type'

    def test_invalid_response_type(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=foobar&redirect_uri={}&client_id={}'.format(
            self.path,
            'https://example.com',
            self.application.client_id,
        ))

        assert resp.status_code == 302
        assert resp['Location'] == 'https://example.com?error=unsupported_response_type'

    def test_missing_client_id(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=code&redirect_uri={}'.format(
            self.path,
            'https://example.com',
        ))

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/oauth-error.html')
        assert resp.context['error'] == 'Missing or invalid ``client_id`` parameter.'

    def test_invalid_scope(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=code&client_id={}&scope=foo'.format(
            self.path,
            self.application.client_id,
        ))

        assert resp.status_code == 302
        assert resp['Location'] == 'https://example.com?error=invalid_scope'

    def test_invalid_redirect_uri(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=code&redirect_uri=https://google.com&client_id={}'.format(
            self.path,
            self.application.client_id,
        ))

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/oauth-error.html')
        assert resp.context['error'] == 'Missing or invalid ``redirect_uri`` parameter.'

    def test_minimal_params_approve_flow(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=code&client_id={}'.format(
            self.path,
            self.application.client_id,
        ))

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/oauth-authorize.html')
        assert resp.context['application'] == self.application

        resp = self.client.post(self.path, {
            'op': 'approve',
        })

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.application.get_default_redirect_uri()
        assert grant.application == self.application
        # TODO(dcramer): BitField API is awful
        assert not grant.scopes.mask

        assert resp.status_code == 302
        assert resp['Location'] == 'https://example.com?code={}'.format(
            grant.code,
        )

    def test_minimal_params_decline_flow(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=code&client_id={}'.format(
            self.path,
            self.application.client_id,
        ))

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/oauth-authorize.html')
        assert resp.context['application'] == self.application

        resp = self.client.post(self.path, {
            'op': 'decline',
        })

        assert resp.status_code == 302
        assert resp['Location'] == 'https://example.com?error=access_denied'

        assert not ApiGrant.objects.filter(user=self.user).exists()
        assert not ApiToken.objects.filter(user=self.user).exists()

    def test_rich_params(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=code&client_id={}&scope=org%3Aread&state=foo'.format(
            self.path,
            self.application.client_id,
        ))

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/oauth-authorize.html')
        assert resp.context['application'] == self.application

        resp = self.client.post(self.path, {
            'op': 'approve',
        })

        grant = ApiGrant.objects.get(user=self.user)
        assert grant.redirect_uri == self.application.get_default_redirect_uri()
        assert grant.application == self.application
        assert getattr(grant.scopes, 'org:read')

        assert resp.status_code == 302
        assert resp['Location'] == 'https://example.com?state=foo&code={}'.format(
            grant.code,
        )

        assert not ApiToken.objects.filter(user=self.user).exists()


class OAuthAuthorizeTokenTest(TestCase):
    @fixture
    def path(self):
        return '/oauth/authorize/'

    def setUp(self):
        super(OAuthAuthorizeTokenTest, self).setUp()
        self.application = ApiApplication.objects.create(
            owner=self.user,
            redirect_uris='https://example.com',
            grant_type=ApiGrantType.implicit,
        )

    def test_missing_response_type(self):
        self.login_as(self.user)

        resp = self.client.get('{}?redirect_uri={}&client_id={}'.format(
            self.path,
            'https://example.com',
            self.application.client_id,
        ))

        assert resp.status_code == 302
        assert resp['Location'] == 'https://example.com?error=unsupported_response_type'

    def test_invalid_response_type(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=foobar&redirect_uri={}&client_id={}'.format(
            self.path,
            'https://example.com',
            self.application.client_id,
        ))

        assert resp.status_code == 302
        assert resp['Location'] == 'https://example.com?error=unsupported_response_type'

    def test_missing_client_id(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=token&redirect_uri={}'.format(
            self.path,
            'https://example.com',
        ))

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/oauth-error.html')
        assert resp.context['error'] == 'Missing or invalid ``client_id`` parameter.'

    def test_invalid_scope(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=token&client_id={}&scope=foo'.format(
            self.path,
            self.application.client_id,
        ))

        assert resp.status_code == 302
        assert resp['Location'] == 'https://example.com#error=invalid_scope'

    def test_minimal_params_approve_flow(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=token&client_id={}'.format(
            self.path,
            self.application.client_id,
        ))

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/oauth-authorize.html')
        assert resp.context['application'] == self.application

        resp = self.client.post(self.path, {
            'op': 'approve',
        })

        assert not ApiGrant.objects.filter(user=self.user).exists()

        token = ApiToken.objects.get(user=self.user)
        assert token.application == self.application
        # TODO(dcramer): BitField API is awful
        assert not token.scopes.mask
        assert not token.refresh_token

        assert resp.status_code == 302
        location, fragment = resp['Location'].split('#', 1)
        assert location == 'https://example.com'
        fragment = parse_qs(fragment)
        assert fragment['access_token'] == [token.token]
        assert fragment['token_type'] == ['bearer']
        assert 'refresh_token' not in fragment
        assert fragment['expires_in']
        assert fragment['token_type'] == ['bearer']

    def test_minimal_params_code_decline_flow(self):
        self.login_as(self.user)

        resp = self.client.get('{}?response_type=token&client_id={}'.format(
            self.path,
            self.application.client_id,
        ))

        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/oauth-authorize.html')
        assert resp.context['application'] == self.application

        resp = self.client.post(self.path, {
            'op': 'decline',
        })

        assert resp.status_code == 302
        location, fragment = resp['Location'].split('#', 1)
        assert location == 'https://example.com'
        fragment = parse_qs(fragment)
        assert fragment == {'error': ['access_denied']}

        assert not ApiToken.objects.filter(user=self.user).exists()
