from unittest.mock import MagicMock, Mock, patch

from fixtures.vsts import VstsIntegrationTestCase
from sentry.integrations.vsts_extension import (
    VstsExtensionFinishedView,
    VstsExtensionIntegrationProvider,
)
from sentry.testutils.silo import control_silo_test
from tests.sentry.integrations.vsts.test_integration import FULL_SCOPES


@control_silo_test
class VstsExtensionIntegrationProviderTest(VstsIntegrationTestCase):
    provider = VstsExtensionIntegrationProvider()
    provider.pipeline = Mock()
    provider.pipeline.organization.id = 1

    @patch(
        "sentry.integrations.vsts.integration.VstsIntegrationProvider.get_scopes",
        return_value=FULL_SCOPES,
    )
    def test_get_pipeline_views(self, mock_get_scopes: MagicMock) -> None:
        views = self.provider.get_pipeline_views()
        assert len(views) == 2
        assert isinstance(views[1], VstsExtensionFinishedView)

    @patch("sentry.integrations.vsts.integration.get_user_info")
    @patch("sentry.integrations.vsts.integration.VstsIntegrationProvider.create_subscription")
    @patch(
        "sentry.integrations.vsts.integration.VstsIntegrationProvider.get_scopes",
        return_value=FULL_SCOPES,
    )
    def test_build_integration(
        self, mock_get_scopes: MagicMock, create_sub: MagicMock, get_user_info: MagicMock
    ) -> None:
        get_user_info.return_value = {"id": "987"}
        create_sub.return_value = (1, "sharedsecret")

        integration = self.provider.build_integration(
            {
                "vsts": {"accountId": self.vsts_account_id, "accountName": "test"},
                "instance": "https://test.visualstudio.com/",
                "identity": {"data": {"access_token": "123", "expires_in": 3000}},
            }
        )

        assert integration["external_id"] == self.vsts_account_id
        assert integration["name"] == "test"
