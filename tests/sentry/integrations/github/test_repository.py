from __future__ import absolute_import

import datetime
import responses
import pytest

from exam import fixture

from sentry.models import Integration, Repository
from sentry.testutils import PluginTestCase
from sentry.testutils.asserts import assert_commit_shape
from sentry.utils import json

from sentry.integrations.exceptions import IntegrationError
from sentry.integrations.github.repository import GitHubRepositoryProvider
from sentry.integrations.github.testutils import (
    COMPARE_COMMITS_EXAMPLE,
    GET_LAST_COMMITS_EXAMPLE,
    GET_COMMIT_EXAMPLE
)


def stub_installation_token():
    ten_hours = datetime.datetime.utcnow() + datetime.timedelta(hours=10)
    responses.add(
        responses.POST,
        'https://api.github.com/installations/654321/access_tokens',
        json={'token': 'v1.install-token', 'expires_at': ten_hours.strftime('%Y-%m-%dT%H:%M:%SZ')}
    )


class GitHubAppsProviderTest(PluginTestCase):
    @fixture
    def provider(self):
        return GitHubRepositoryProvider('integrations:github')

    @fixture
    def repository(self):
        organization = self.create_organization()
        integration = Integration.objects.create(
            provider='github',
            external_id='654321',
        )
        return Repository.objects.create(
            name='example-repo',
            provider='integrations:github',
            organization_id=organization.id,
            integration_id=integration.id,
            config={'name': 'getsentry/example-repo'},
        )

    @responses.activate
    def test_build_repository_config(self):
        organization = self.create_organization()
        integration = Integration.objects.create(
            provider='github',
            name='Example Github',
        )
        integration.add_organization(organization, self.user)
        data = {
            'identifier': 'getsentry/example-repo',
            'external_id': '654321',
            'integration_id': integration.id,
        }
        data = self.provider.build_repository_config(organization, data)
        assert data == {
            'config': {
                'name': 'getsentry/example-repo',
            },
            'external_id': '654321',
            'integration_id': integration.id,
            'name': 'getsentry/example-repo',
            'url': 'https://github.com/getsentry/example-repo',
        }

    @responses.activate
    def test_compare_commits_no_start(self):
        stub_installation_token()
        responses.add(
            responses.GET,
            'https://api.github.com/repos/getsentry/example-repo/commits?sha=abcdef',
            json=json.loads(GET_LAST_COMMITS_EXAMPLE)
        )
        responses.add(
            responses.GET,
            'https://api.github.com/repos/getsentry/example-repo/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e',
            json=json.loads(GET_COMMIT_EXAMPLE)
        )
        result = self.provider.compare_commits(self.repository, None, 'abcdef')
        for commit in result:
            assert_commit_shape(commit)

    @responses.activate
    def test_compare_commits_no_start_failure(self):
        stub_installation_token()
        responses.add(
            responses.GET,
            'https://api.github.com/repos/getsentry/example-repo/commits?sha=abcdef',
            status=502
        )
        with pytest.raises(IntegrationError):
            self.provider.compare_commits(self.repository, None, 'abcdef')

    @responses.activate
    def test_compare_commits(self):
        stub_installation_token()
        responses.add(
            responses.GET,
            'https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef',
            json=json.loads(COMPARE_COMMITS_EXAMPLE)
        )
        responses.add(
            responses.GET,
            'https://api.github.com/repos/getsentry/example-repo/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e',
            json=json.loads(GET_COMMIT_EXAMPLE)
        )
        result = self.provider.compare_commits(self.repository, 'xyz123', 'abcdef')
        for commit in result:
            assert_commit_shape(commit)

    @responses.activate
    def test_compare_commits_patchset_handling(self):
        stub_installation_token()
        responses.add(
            responses.GET,
            'https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef',
            json=json.loads(COMPARE_COMMITS_EXAMPLE)
        )
        responses.add(
            responses.GET,
            'https://api.github.com/repos/getsentry/example-repo/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e',
            json=json.loads(GET_COMMIT_EXAMPLE)
        )
        result = self.provider.compare_commits(self.repository, 'xyz123', 'abcdef')

        patchset = result[0]['patch_set']
        assert patchset[0] == {'path': 'file1.txt', 'type': 'M'}
        assert patchset[1] == {'path': 'added.txt', 'type': 'A'}
        assert patchset[2] == {'path': 'removed.txt', 'type': 'D'}
        assert patchset[3] == {'path': 'old_name.txt', 'type': 'D'}
        assert patchset[4] == {'path': 'renamed.txt', 'type': 'A'}

    @responses.activate
    def test_compare_commits_failure(self):
        stub_installation_token()
        responses.add(
            responses.GET,
            'https://api.github.com/repos/getsentry/example-repo/compare/xyz123...abcdef',
            status=502
        )
        with pytest.raises(IntegrationError):
            self.provider.compare_commits(self.repository, 'xyz123', 'abcdef')
