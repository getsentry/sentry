from sentry.plugins.base.v2 import Plugin2
from sentry.testutils.cases import TestCase


class Plugin2TestCase(TestCase):
    def test_reset_config(self):
        class APlugin(Plugin2):
            def get_conf_key(self):
                return "a-plugin"

        project = self.create_project()

        a_plugin = APlugin()
        a_plugin.set_option("key", "value", project=project)
        assert a_plugin.get_option("key", project=project) == "value"
        a_plugin.reset_options(project=project)
        assert a_plugin.get_option("key", project=project) is None
