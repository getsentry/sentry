from __future__ import absolute_import


from sentry.integrations.jira.extension_configuration import JiraExtensionConfigurationView
from sentry.testutils import TestCase
from sentry.utils import json
from sentry.utils.signing import sign


class JiraExtensionConfigurationTest(TestCase):
    def test_map_params_to_state(self):
        config_view = JiraExtensionConfigurationView()
        metadata = {"my_param": "test"}
        data = {"metadata": json.dumps(metadata)}
        signed_data = sign(**data)
        params = {"signed_params": signed_data}
        assert {"metadata": metadata} == config_view.map_params_to_state(params)
