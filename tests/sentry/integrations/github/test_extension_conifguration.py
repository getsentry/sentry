from sentry.integrations.github.github_extension_installation import (
    GithubExtensionConfigurationView,
)
from sentry.testutils import TestCase
from sentry.utils.signing import sign


class GithubExtensionInstallationTest(TestCase):
    def test_map_params_to_state(self):
        config_view = GithubExtensionConfigurationView()
        data = dict(install_id=1, provider="github")
        signed_data = sign(**data)
        params = {"signed_params": signed_data}
        assert data == config_view.map_params_to_state(params)
