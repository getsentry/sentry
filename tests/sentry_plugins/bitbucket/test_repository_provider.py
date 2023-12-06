from functools import cached_property

import responses

from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry_plugins.bitbucket.repository_provider import BitbucketRepositoryProvider
from sentry_plugins.bitbucket.testutils import COMMIT_DIFF_PATCH, COMPARE_COMMITS_EXAMPLE


@region_silo_test
class BitbucketPluginTest(TestCase):
    @cached_property
    def provider(self):
        return BitbucketRepositoryProvider("bitbucket")

    @responses.activate
    def test_compare_commits(self):
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/commits/e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
            body=COMPARE_COMMITS_EXAMPLE,
        )
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/maxbittker/newsdiffs/diff/e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
            body=COMMIT_DIFF_PATCH,
        )
        repo = Repository.objects.create(
            provider="bitbucket",
            name="maxbittker/newsdiffs",
            organization_id=1,
            config={"name": "maxbittker/newsdiffs"},
        )
        user = self.user
        self.create_usersocialauth(
            provider="bitbucket",
            user=user,
            uid="1",
            extra_data={
                "access_token": "oauth_token=oauth-token&oauth_token_secret=oauth-token-secret"
            },
        )

        res = self.provider.compare_commits(
            repo, None, "e18e4e72de0d824edfbe0d73efe34cbd0d01d301", actor=user
        )

        assert res == [
            {
                "author_email": "max@getsentry.com",
                "author_name": "Max Bittker",
                "message": "README.md edited online with Bitbucket",
                "id": "e18e4e72de0d824edfbe0d73efe34cbd0d01d301",
                "repository": "maxbittker/newsdiffs",
                "patch_set": [{"path": "README.md", "type": "M"}],
            }
        ]
