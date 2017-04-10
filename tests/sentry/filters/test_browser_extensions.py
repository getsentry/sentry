from __future__ import absolute_import

from sentry.filters.browser_extensions import BrowserExtensionsFilter
from sentry.testutils import TestCase


class BrowserExtensionsFilterTest(TestCase):
    filter_cls = BrowserExtensionsFilter

    def apply_filter(self, data):
        return self.filter_cls(self.project).test(data)

    def get_mock_data(self, exc_value=None, exc_source=None):
        return {
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [
                    {
                        'type': 'Error',
                        'value': exc_value or 'undefined is not defined',
                        'stacktrace': {
                            'frames': [
                                {
                                    'abs_path': 'http://example.com/foo.js'
                                },
                                {
                                    'abs_path': exc_source or 'http://example.com/bar.js'
                                },
                            ],
                        }
                    }
                ]
            }
        }

    def test_bails_without_javascript_event(self):
        data = {
            'platform': 'python'
        }
        assert not self.apply_filter(data)

    def test_filters_conduit_toolbar(self):
        data = self.get_mock_data(exc_value='what does conduitPage even do')
        assert self.apply_filter(data)

    def test_filters_google_search_app_ios(self):
        data = self.get_mock_data(exc_value='null is not an object (evaluating \'elt.parentNode\')')
        assert self.apply_filter(data)

    def test_filters_kaspersky_extension(self):
        data = self.get_mock_data(exc_source='https://ff.kis.v2.scr.kaspersky-labs.com/14E4A3DB-9B72-1047-8296-E970532BF7B7/main.js')
        assert self.apply_filter(data)

    def test_filters_dragon_web_extension(self):
        data = self.get_mock_data(exc_value='plugin.setSuspendState is not a function')
        assert self.apply_filter(data)

    def test_filters_chrome_extensions(self):
        data = self.get_mock_data(exc_source='chrome://my-extension/or/something')
        assert self.apply_filter(data)

    def test_filters_chrome_extensions_second_format(self):
        data = self.get_mock_data(exc_source='chrome-extension://my-extension/or/something')
        assert self.apply_filter(data)

    def test_does_not_filter_generic_data(self):
        data = self.get_mock_data()
        assert not self.apply_filter(data)

    def test_filters_malformed_data(self):
        data = self.get_mock_data()
        data['sentry.interfaces.Exception'] = None
        assert not self.apply_filter(data)
