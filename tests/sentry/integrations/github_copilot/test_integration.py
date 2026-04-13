from sentry.integrations.github_copilot.integration import GithubCopilotIntegrationProvider
from sentry.testutils.cases import TestCase


class GithubCopilotIntegrationProviderTest(TestCase):
    def setUp(self):
        super().setUp()
        self.provider = GithubCopilotIntegrationProvider()

    def test_key(self):
        assert self.provider.key == "github_copilot"

    def test_requires_feature_flag_true(self):
        assert self.provider.requires_feature_flag is True

    def test_feature_flag_name(self):
        assert self.provider.feature_flag_name == "organizations:integrations-github-copilot-agent"

    def test_no_pipeline_views(self):
        assert self.provider.get_pipeline_views() == []

    def test_build_integration(self):
        data = self.provider.build_integration({})
        assert data["name"] == "GitHub Copilot"
        assert "external_id" in data
        assert data["metadata"] == {}

    def test_build_integration_generates_unique_external_ids(self):
        data1 = self.provider.build_integration({})
        data2 = self.provider.build_integration({})
        assert data1["external_id"] != data2["external_id"]

    def test_direct_enable_aspect(self):
        assert self.provider.metadata.aspects.get("directEnable") is True

    def test_allow_multiple_false(self):
        assert self.provider.allow_multiple is False
