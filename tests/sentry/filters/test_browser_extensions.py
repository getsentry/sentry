from __future__ import absolute_import

from sentry.message_filters import _browser_extensions_filter
from sentry.relay.config import ProjectConfig
from sentry.testutils import TestCase


class BrowserExtensionsFilterTest(TestCase):
    def apply_filter(self, data):
        project_config = ProjectConfig(self.project)
        return _browser_extensions_filter(project_config, data)

    def get_mock_data(self, exc_value=None, exc_source=None):
        return {
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "value": exc_value or "undefined is not defined",
                        "stacktrace": {
                            "frames": [
                                {"abs_path": "http://example.com/foo.js"},
                                {"abs_path": exc_source or "http://example.com/bar.js"},
                            ]
                        },
                    }
                ]
            },
        }

    def test_bails_without_javascript_event(self):
        data = {"platform": "python"}
        assert not self.apply_filter(data)

    def test_filters_conduit_toolbar(self):
        data = self.get_mock_data(exc_value="what does conduitPage even do")
        assert self.apply_filter(data)

    def test_filters_google_search_app_ios(self):
        data = self.get_mock_data(exc_value="null is not an object (evaluating 'elt.parentNode')")
        assert self.apply_filter(data)

    def test_filters_kaspersky_extension(self):
        data = self.get_mock_data(
            exc_source=(
                "https://ff.kis.v2.scr.kaspersky-labs.com/14E4A3DB-9B72-1047-8296-E970532BF7B7/main.js"
            )
        )
        assert self.apply_filter(data)

    def test_filters_dragon_web_extension(self):
        data = self.get_mock_data(exc_value="plugin.setSuspendState is not a function")
        assert self.apply_filter(data)

    def test_filters_chrome_extensions(self):
        data = self.get_mock_data(exc_source="chrome://my-extension/or/something")
        assert self.apply_filter(data)

    def test_filters_chrome_extensions_second_format(self):
        data = self.get_mock_data(exc_source="chrome-extension://my-extension/or/something")
        assert self.apply_filter(data)

    def test_filters_firefox_extensions(self):
        data = self.get_mock_data(exc_source="moz-extension://my-extension/or/something")
        assert self.apply_filter(data)

    def test_filters_safari_extensions(self):
        data = self.get_mock_data(exc_source="safari-extension://my-extension/or/something")
        assert self.apply_filter(data)

    def test_does_not_filter_generic_data(self):
        data = self.get_mock_data()
        assert not self.apply_filter(data)

    def test_filters_malformed_data(self):
        data = self.get_mock_data()
        data["exception"] = None
        assert not self.apply_filter(data)

    def test_filters_facebook_source(self):
        data = self.get_mock_data(exc_source="https://graph.facebook.com/")
        assert self.apply_filter(data)

        data = self.get_mock_data(exc_source="https://connect.facebook.net/en_US/sdk.js")
        assert self.apply_filter(data)

    def test_filters_woopra_source(self):
        data = self.get_mock_data(exc_source="https://static.woopra.com/js/woopra.js")
        assert self.apply_filter(data)

    def test_filters_itunes_source(self):
        data = self.get_mock_data(
            exc_source="http://metrics.itunes.apple.com.edgesuite.net/itunespreview/itunes/browser:firefo"
        )
        assert self.apply_filter(data)
