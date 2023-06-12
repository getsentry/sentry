from sentry.integrations.jira.views import JiraExtensionConfigurationView
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.signing import sign


@control_silo_test(stable=True)
class JiraExtensionConfigurationTest(TestCase):
    def test_map_params_to_state(self):
        config_view = JiraExtensionConfigurationView()
        metadata = {"my_param": "test"}
        data = {"metadata": json.dumps(metadata)}
        signed_data = sign(**data)
        params = {"signed_params": signed_data}
        assert {"metadata": metadata} == config_view.map_params_to_state(params)
