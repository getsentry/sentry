from sentry.integrations.github_copilot.integration import GithubCopilotIntegrationProvider
from sentry.testutils.cases import TestCase


class GithubCopilotIntegrationProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = GithubCopilotIntegrationProvider()

    def test_key(self) -> None:
        assert self.provider.key == "github_copilot"

    def test_requires_feature_flag_false(self) -> None:
        assert self.provider.requires_feature_flag is False

    def test_build_integration(self) -> None:
        data = self.provider.build_integration({})
        assert data["name"] == "GitHub Copilot"
        assert "external_id" in data
        assert data["metadata"] == {}

    def test_build_integration_generates_unique_external_ids(self) -> None:
        data1 = self.provider.build_integration({})
        data2 = self.provider.build_integration({})
        assert data1["external_id"] != data2["external_id"]

    def test_direct_enable_aspect(self) -> None:
        assert self.provider.metadata.aspects.get("directEnable") is True

    def test_allow_multiple_false(self) -> None:
        assert self.provider.allow_multiple is False
