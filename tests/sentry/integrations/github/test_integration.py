from __future__ import absolute_import

import responses
import six
import sentry

from mock import MagicMock
from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.constants import ObjectStatus
from sentry.integrations.github import GitHubIntegrationProvider
from sentry.models import (
    Identity, IdentityProvider, IdentityStatus, Integration, OrganizationIntegration,
    Repository, Project
)
from sentry.plugins import plugins
from sentry.testutils import IntegrationTestCase
from tests.sentry.plugins.testutils import GitHubPlugin  # NOQA


class GitHubIntegrationTest(IntegrationTestCase):
    provider = GitHubIntegrationProvider

    def setUp(self):
        super(GitHubIntegrationTest, self).setUp()

        self.installation_id = 'install_1'
        self.user_id = 'user_1'
        self.app_id = 'app_1'
        self.access_token = 'xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx'
        self.expires_at = '3000-01-01T00:00:00Z'

        self._stub_github()

    def _stub_github(self):
        responses.reset()

        sentry.integrations.github.integration.get_jwt = MagicMock(
            return_value='jwt_token_1',
        )
        sentry.integrations.github.client.get_jwt = MagicMock(
            return_value='jwt_token_1',
        )

        responses.add(
            responses.POST,
            'https://github.com/login/oauth/access_token',
            json={'access_token': self.access_token}
        )

        responses.add(
            responses.POST,
            u'https://api.github.com/installations/{}/access_tokens'.format(
                self.installation_id,
            ),
            json={
                'token': self.access_token,
                'expires_at': self.expires_at,
            }
        )

        responses.add(
            responses.GET,
            'https://api.github.com/user',
            json={'id': self.user_id}
        )

        responses.add(
            responses.GET,
            u'https://api.github.com/installation/repositories',
            json={
                'repositories': [
                    {
                        'id': 1296269,
                        'name': 'foo',
                        'full_name': 'Test-Organization/foo',
                    },
                    {
                        'id': 9876574,
                        'name': 'bar',
                        'full_name': 'Test-Organization/bar',
                    },
                ],
            }
        )

        responses.add(
            responses.GET,
            u'https://api.github.com/app/installations/{}'.format(
                self.installation_id,
            ),
            json={
                'id': self.installation_id,
                'app_id': self.app_id,
                'account': {
                    'login': 'Test Organization',
                    'avatar_url': 'http://example.com/avatar.png',
                    'html_url': 'https://github.com/Test-Organization',
                    'type': 'Organization',
                },
            }
        )

        responses.add(
            responses.GET,
            u'https://api.github.com/user/installations',
            json={
                'installations': [{'id': self.installation_id}],
            }
        )

        responses.add(
            responses.GET,
            u'https://api.github.com/repos/Test-Organization/foo/hooks',
            json=[],
        )

    def assert_setup_flow(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'github.com'
        assert redirect.path == '/apps/sentry-test-app'

        # App installation ID is provided
        resp = self.client.get(u'{}?{}'.format(
            self.setup_path,
            urlencode({'installation_id': self.installation_id})
        ))

        redirect = urlparse(resp['Location'])

        assert resp.status_code == 302
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'github.com'
        assert redirect.path == '/login/oauth/authorize'

        params = parse_qs(redirect.query)

        assert params['state']
        assert params['redirect_uri'] == ['http://testserver/extensions/github/setup/']
        assert params['response_type'] == ['code']
        assert params['client_id'] == ['github-client-id']

        # Compact list values into singular values, since there's only ever one.
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        resp = self.client.get(u'{}?{}'.format(
            self.setup_path,
            urlencode({
                'code': 'oauth-code',
                'state': authorize_params['state'],
            })
        ))

        oauth_exchange = responses.calls[0]
        req_params = parse_qs(oauth_exchange.request.body)

        assert req_params['grant_type'] == ['authorization_code']
        assert req_params['code'] == ['oauth-code']
        assert req_params['redirect_uri'] == ['http://testserver/extensions/github/setup/']
        assert req_params['client_id'] == ['github-client-id']
        assert req_params['client_secret'] == ['github-client-secret']

        assert oauth_exchange.response.status_code == 200

        auth_header = responses.calls[2].request.headers['Authorization']
        assert auth_header == 'Bearer jwt_token_1'

        self.assertDialogSuccess(resp)
        return resp

    @responses.activate
    def test_plugin_migration(self):
        accessible_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name='Test-Organization/foo',
            url='https://github.com/Test-Organization/foo',
            provider='github',
            external_id=123,
            config={
                'name': 'Test-Organization/foo',
            },
        )

        inaccessible_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name='Not-My-Org/other',
            provider='github',
            external_id=321,
            config={
                'name': 'Not-My-Org/other',
            },
        )

        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        # Updates the existing Repository to belong to the new Integration
        assert Repository.objects.get(
            id=accessible_repo.id,
        ).integration_id == integration.id

        # Doesn't touch Repositories not accessible by the new Integration
        assert Repository.objects.get(
            id=inaccessible_repo.id,
        ).integration_id is None

    @responses.activate
    def test_disables_plugin_when_fully_migrated(self):
        project = Project.objects.create(
            organization_id=self.organization.id,
        )

        plugin = plugins.get('github')
        plugin.enable(project)

        # Accessible to new Integration
        Repository.objects.create(
            organization_id=self.organization.id,
            name='Test-Organization/foo',
            url='https://github.com/Test-Organization/foo',
            provider='github',
            external_id=123,
            config={
                'name': 'Test-Organization/foo',
            },
        )

        assert 'github' in [p.slug for p in plugins.for_project(project)]

        with self.tasks():
            self.assert_setup_flow()

        assert 'github' not in [p.slug for p in plugins.for_project(project)]

    @responses.activate
    def test_basic_flow(self):
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == self.installation_id
        assert integration.name == 'Test Organization'
        assert integration.metadata == {
            'access_token': None,
            # The metadata doesn't get saved with the timezone "Z" character
            # for some reason, so just compare everything but that.
            'expires_at': None,
            'icon': 'http://example.com/avatar.png',
            'domain_name': 'github.com/Test-Organization',
            'account_type': 'Organization',
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration,
            organization=self.organization,
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type='github')
        identity = Identity.objects.get(
            idp=idp,
            user=self.user,
            external_id=self.user_id,
        )
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {
            'access_token': self.access_token,
        }

    @responses.activate
    def test_reassign_user(self):
        self.assert_setup_flow()

        # Associate the identity with a user that has a password.
        # Identity should be relinked.
        user2 = self.create_user()
        Identity.objects.get().update(user=user2)
        self.assert_setup_flow()
        identity = Identity.objects.get()
        assert identity.user == self.user

        # Associate the identity with a user without a password.
        # Identity should not be relinked.
        user2.set_unusable_password()
        user2.save()
        Identity.objects.get().update(user=user2)
        resp = self.assert_setup_flow()
        assert '"success":false' in resp.content
        assert 'The provided GitHub account is linked to a different user' in resp.content

    @responses.activate
    def test_reinstall_flow(self):
        self._stub_github()
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        integration.update(status=ObjectStatus.DISABLED)
        assert integration.status == ObjectStatus.DISABLED
        assert integration.external_id == self.installation_id

        resp = self.client.get(u'{}?{}'.format(
            self.init_path,
            urlencode({'reinstall_id': integration.id})
        ))

        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'github.com'
        assert redirect.path == '/apps/sentry-test-app'

        # New Installation
        self.installation_id = 'install_2'

        resp = self.client.get(u'{}?{}'.format(
            self.setup_path,
            urlencode({'installation_id': self.installation_id})
        ))

        redirect = urlparse(resp['Location'])

        assert resp.status_code == 302
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'github.com'
        assert redirect.path == '/login/oauth/authorize'

        params = parse_qs(redirect.query)

        assert params['state']
        assert params['redirect_uri'] == ['http://testserver/extensions/github/setup/']
        assert params['response_type'] == ['code']
        assert params['client_id'] == ['github-client-id']

        # Compact list values to make the rest of this easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        self._stub_github()

        resp = self.client.get(u'{}?{}'.format(
            self.setup_path,
            urlencode({
                'code': 'oauth-code',
                'state': authorize_params['state'],
            })
        ))

        mock_access_token_request = responses.calls[0].request
        req_params = parse_qs(mock_access_token_request.body)
        assert req_params['grant_type'] == ['authorization_code']
        assert req_params['code'] == ['oauth-code']
        assert req_params['redirect_uri'] == ['http://testserver/extensions/github/setup/']
        assert req_params['client_id'] == ['github-client-id']
        assert req_params['client_secret'] == ['github-client-secret']

        assert resp.status_code == 200

        auth_header = responses.calls[2].request.headers['Authorization']
        assert auth_header == 'Bearer jwt_token_1'

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.status == ObjectStatus.VISIBLE
        assert integration.external_id == self.installation_id

    @responses.activate
    def test_disable_plugin_when_fully_migrated(self):
        self._stub_github()

        project = Project.objects.create(
            organization_id=self.organization.id,
        )

        plugin = plugins.get('github')
        plugin.enable(project)

        # Accessible to new Integration - mocked in _stub_github
        Repository.objects.create(
            organization_id=self.organization.id,
            name='Test-Organization/foo',
            url='https://github.com/Test-Organization/foo',
            provider='github',
            external_id='123',
            config={
                'name': 'Test-Organization/foo',
            },
        )

        # Enabled before
        assert 'github' in [p.slug for p in plugins.for_project(project)]

        with self.tasks():
            self.assert_setup_flow()

        # Disabled after Integration installed
        assert 'github' not in [p.slug for p in plugins.for_project(project)]
