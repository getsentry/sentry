from ua_parser.user_agent_parser import Parse

from sentry.plugins.sentry_useragents.models import BrowserPlugin, DevicePlugin, OsPlugin
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserAgentPlugins(TestCase):
    data = [
        {
            "user_agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "browser_plugin_output": "Googlebot 2.1",
            "device_plugin_output": "Spider",
            "os_plugin_output": "Other",
        }
    ]

    def test_plugins(self):
        for row in self.data:
            ua = Parse(row["user_agent"])
            assert BrowserPlugin().get_tag_from_ua(ua) == row["browser_plugin_output"]
            assert DevicePlugin().get_tag_from_ua(ua) == row["device_plugin_output"]
            assert OsPlugin().get_tag_from_ua(ua) == row["os_plugin_output"]
