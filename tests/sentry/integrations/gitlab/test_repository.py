from __future__ import absolute_import

import responses

from exam import fixture

from django.core.urlresolvers import reverse

from sentry.models import Identity, IdentityProvider, Integration, Repository
from sentry.testutils import PluginTestCase

from sentry.integrations.gitlab.repository import GitlabRepositoryProvider


class GitLabRepositoryProviderTest(PluginTestCase):
    provider_name = 'integrations:gitlab'

    def setUp(self):
        responses.reset()
        super(GitLabRepositoryProviderTest, self).setUp()
        self.login_as(self.user)
        self.integration = Integration.objects.create(
            provider='gitlab',
            name='Example GitLab',
            external_id='example.gitlab.com:55',
            metadata={
                'domain_name': 'example.gitlab.com/my-group',
                'verify_ssl': False,
                'base_url': 'https://example.gitlab.com',
            }
        )
        identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(
                type='gitlab',
                config={},
                external_id='1234567890',
            ),
            user=self.user,
            external_id='example.gitlab.com:4',
            data={
                'access_token': '1234567890',
            }
        )
        self.integration.add_organization(self.organization, self.user, identity.id)
        self.integration.get_provider().setup()

        self.default_repository_config = {
            'path_with_namespace': 'getsentry/example-repo',
            'name_with_namespace': 'Get Sentry / Example Repo',
            'path': 'example-repo',
            'id': 123,
            'web_url': 'https://example.gitlab.com/my-group/projects/example-repo',
        }

    @fixture
    def provider(self):
        return GitlabRepositoryProvider()

    def create_repository(self, repository_config, integration_id, organization_slug=None):
        repo_id = repository_config['id']
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s' % repo_id,
            json=repository_config
        )

        with self.feature({'organizations:internal-catchall': True, 'organizations:repos': True}):
            response = self.client.post(
                path=reverse(
                    'sentry-api-0-organization-repositories',
                    args=[organization_slug or self.organization.slug]
                ),
                data={
                    'provider': self.provider_name,
                    'installation': integration_id,
                    'identifier': repo_id,
                }
            )
        return response

    def assert_repository(self, repository_config, organization_id=None):
        domain_name = self.integration.metadata['domain_name']
        repo = Repository.objects.get(
            organization_id=organization_id or self.organization.id,
            provider=self.provider_name,
            external_id='%s:example-repo' % (domain_name,)
        )
        assert repo.name == repository_config['name_with_namespace']
        assert repo.url == repository_config['web_url']
        assert repo.integration_id == self.integration.id
        assert repo.config == {
            'instance': domain_name,
            'repo_id': repository_config['id'],
            'path': repository_config['path_with_namespace'],
        }

    @responses.activate
    def test_create_repository(self):
        response = self.create_repository(self.default_repository_config, self.integration.id)
        assert response.status_code == 201
        self.assert_repository(self.default_repository_config)

    def test_create_repository_null_installation_id(self):
        response = self.create_repository(self.default_repository_config, None)
        assert response.status_code == 500

    def test_create_repository_integration_does_not_exist(self):
        integration_id = self.integration.id
        self.integration.delete()

        response = self.create_repository(self.default_repository_config, integration_id)
        assert response.status_code == 500  # TODO(lb): shouldn't this result in a 404?

    def test_create_repository_org_given_has_no_installation(self):
        organization = self.create_organization(owner=self.user)
        response = self.create_repository(
            self.default_repository_config,
            self.integration.id,
            organization.slug)
        assert response.status_code == 500

    @responses.activate
    def test_create_repository_projects_request_fails(self):
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s' % self.default_repository_config['id'],
            status=503,
        )
        response = self.create_repository(self.default_repository_config, self.integration.id)
        # TODO(lb): it gives a 400 which I'm not sure makes sense here
        assert response.status_code == 400
