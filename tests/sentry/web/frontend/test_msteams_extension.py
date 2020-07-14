from __future__ import absolute_import


from sentry.testutils import TestCase
from sentry.web.frontend.msteams_extension_configuration import MsTeamsExtensionConfigurationView
from sentry.utils.signing import sign


class MsTeamsExtensionConfigurationTest(TestCase):
    def test_map_params(self):
        config_view = MsTeamsExtensionConfigurationView()
        data = {"my_param": "test"}
        signed_data = sign(**data)
        params = {"signed_params": signed_data}
        assert data == config_view.map_params_to_state(params)
