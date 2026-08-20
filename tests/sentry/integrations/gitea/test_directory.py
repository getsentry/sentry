from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


class GiteaIntegrationDirectoryTest(APITestCase):
    """The Gitea provider is only listed in the integration directory for orgs
    that have `organizations:integrations-gitea` enabled."""

    endpoint = "sentry-api-0-organization-config-integrations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_hidden_without_the_feature_flag(self) -> None:
        response = self.get_success_response(self.organization.slug)
        assert "gitea" not in {provider["key"] for provider in response.data["providers"]}

    @with_feature("organizations:integrations-gitea")
    def test_listed_with_the_feature_flag(self) -> None:
        response = self.get_success_response(self.organization.slug)
        providers = {provider["key"]: provider for provider in response.data["providers"]}

        assert "gitea" in providers
        assert providers["gitea"]["name"] == "Gitea"
        assert providers["gitea"]["canAdd"] is True
        assert set(providers["gitea"]["features"]) == {
            "commits",
            "stacktrace-link",
            "issue-basic",
        }
