from ua_parser.user_agent_parser import Parse

from sentry.plugins.sentry_useragents.models import BrowserPlugin, DevicePlugin, OsPlugin
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserAgentPlugins(TestCase):
    data = [
        {
            "user_agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "browser_plugin_output": "Googlebot 2.1",
            "device_plugin_output": "Spider",
            "os_plugin_output": "Other",
        },
        {
            "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
            "browser_plugin_output": "Chrome 110.0",
            "device_plugin_output": "Mac",
            "os_plugin_output": "Mac OS X >=10.15.7",
        },
        {
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36.",
            "browser_plugin_output": "Chrome 110.0",
            "device_plugin_output": "Other",
            "os_plugin_output": "Windows >=10",
        },
    ]

    def test_plugins(self):
        for row in self.data:
            ua = Parse(row["user_agent"])
            assert BrowserPlugin().get_tag_from_ua(ua) == row["browser_plugin_output"]
            assert DevicePlugin().get_tag_from_ua(ua) == row["device_plugin_output"]
            assert OsPlugin().get_tag_from_ua(ua) == row["os_plugin_output"]
