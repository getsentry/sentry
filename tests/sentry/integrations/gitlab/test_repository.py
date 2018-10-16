from __future__ import absolute_import

import responses

from exam import fixture

from django.core.urlresolvers import reverse

from sentry.models import Identity, IdentityProvider, Integration, Repository
from sentry.testutils import PluginTestCase
from sentry.utils import json

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
            external_id='example.gitlab.com:getsentry',
            metadata={
                'instance': 'example.gitlab.com',
                'domain_name': 'example.gitlab.com/getsentry',
                'verify_ssl': False,
                'base_url': 'https://example.gitlab.com',
                'webhook_secret': 'secret-token-value',
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
            'web_url': 'https://example.gitlab.com/getsentry/projects/example-repo',
        }
        self.gitlab_id = 123

    @fixture
    def provider(self):
        return GitlabRepositoryProvider('gitlab')

    def create_repository(self, repository_config, integration_id, organization_slug=None):
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s' % self.gitlab_id,
            json=repository_config
        )
        responses.add(
            responses.POST,
            u'https://example.gitlab.com/api/v4/projects/%s/hooks' % self.gitlab_id,
            json={'id': 99}
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
                    'identifier': repository_config['id'],
                }
            )
        return response

    def assert_repository(self, repository_config, organization_id=None):
        instance = self.integration.metadata['instance']

        external_id = u'{}:{}'.format(instance, repository_config['id'])
        repo = Repository.objects.get(
            organization_id=organization_id or self.organization.id,
            provider=self.provider_name,
            external_id=external_id
        )
        assert repo.name == repository_config['name_with_namespace']
        assert repo.url == repository_config['web_url']
        assert repo.integration_id == self.integration.id
        assert repo.config == {
            'instance': instance,
            'path': repository_config['path_with_namespace'],
            'project_id': repository_config['id'],
            'webhook_id': 99,
        }

    @responses.activate
    def test_create_repository(self):
        response = self.create_repository(self.default_repository_config, self.integration.id)
        assert response.status_code == 201
        self.assert_repository(self.default_repository_config)

    @responses.activate
    def test_create_repository_verify_payload(self):
        def request_callback(request):
            payload = json.loads(request.body)
            assert 'url' in payload
            assert payload['push_events']
            assert payload['merge_requests_events']
            expected_token = u'{}:{}'.format(self.integration.external_id,
                                             self.integration.metadata['webhook_secret'])
            assert payload['token'] == expected_token

            return (201, {}, json.dumps({'id': 99}))

        responses.add_callback(
            responses.POST,
            u'https://example.gitlab.com/api/v4/projects/%s/hooks' % self.gitlab_id,
            callback=request_callback
        )
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
    def test_create_repository_get_project_request_fails(self):
        responses.add(
            responses.GET,
            u'https://example.gitlab.com/api/v4/projects/%s' % self.gitlab_id,
            status=503,
        )
        response = self.create_repository(self.default_repository_config, self.integration.id)
        # TODO(lb): it gives a 400 which I'm not sure makes sense here
        assert response.status_code == 400

    @responses.activate
    def test_create_repository_integration_create_webhook_failure(self):
        responses.add(
            responses.POST,
            u'https://example.gitlab.com/api/v4/projects/%s/hooks' % self.gitlab_id,
            status=503,
        )
        response = self.create_repository(self.default_repository_config,
                                          self.integration.id)
        assert response.status_code == 400

    @responses.activate
    def test_on_delete_repository_remove_webhook(self):
        response = self.create_repository(self.default_repository_config,
                                          self.integration.id)
        responses.reset()

        responses.add(
            responses.DELETE,
            'https://example.gitlab.com/api/v4/projects/%s/hooks/99' % self.gitlab_id,
            status=204
        )
        repo = Repository.objects.get(pk=response.data['id'])
        self.provider.on_delete_repository(repo)
        assert len(responses.calls) == 1

    @responses.activate
    def test_on_delete_repository_remove_webhook_missing_hook(self):
        response = self.create_repository(self.default_repository_config,
                                          self.integration.id)
        responses.reset()

        responses.add(
            responses.DELETE,
            'https://example.gitlab.com/api/v4/projects/%s/hooks/99' % self.gitlab_id,
            status=404
        )
        repo = Repository.objects.get(pk=response.data['id'])
        self.provider.on_delete_repository(repo)
        assert len(responses.calls) == 1
