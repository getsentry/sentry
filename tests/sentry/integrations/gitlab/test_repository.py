from __future__ import absolute_import

import responses

from exam import fixture

from django.core.urlresolvers import reverse

from sentry.models import Identity, IdentityProvider, Integration, Repository
from sentry.testutils import PluginTestCase

from sentry.integrations.gitlab.repository import GitlabRepositoryProvider


class GitLabProviderTest(PluginTestCase):
    provider_name = 'integrations:gitlab'

    @fixture
    def provider(self):
        return GitlabRepositoryProvider()

    @responses.activate
    def test_create_repository(self):
        self.login_as(self.user)
        repo_id = 123
        repo_path = 'getsentry/example-repo'
        name_with_namespace = 'Get Sentry / Example Repo'
        repo_url = 'https://example.gitlab.com/my-group/projects/example-repo'
        domain_name = 'example.gitlab.com/my-group'
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s' % repo_id,
            json={
                'path_with_namespace': repo_path,
                'name_with_namespace': name_with_namespace,
                'path': 'example-repo',
                'id': repo_id,
                'web_url': repo_url,
            }
        )
        integration = Integration.objects.create(
            provider='gitlab',
            name='Example GitLab',
            external_id='example.gitlab.com:55',
            metadata={
                'domain_name': domain_name,
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
        integration.add_organization(self.organization, self.user, identity.id)
        integration.get_provider().setup()
        with self.feature({'organizations:internal-catchall': True, 'organizations:repos': True}):
            response = self.client.post(
                path=reverse(
                    'sentry-api-0-organization-repositories',
                    args=[
                        self.organization.slug]),
                data={
                    'provider': self.provider_name,
                    'installation': integration.id,
                    'identifier': repo_id,
                }
            )

        assert response.status_code == 201
        repo = Repository.objects.get(
            organization_id=self.organization.id,
            provider=self.provider_name,
            external_id='%s:example-repo' % (domain_name,)
        )
        assert repo.name == name_with_namespace
        assert repo.url == repo_url
        assert repo.integration_id == integration.id
        assert repo.config == {
            'instance': domain_name,
            'repo_id': repo_id,
            'path': repo_path,
        }
