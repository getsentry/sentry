from __future__ import absolute_import

from sentry.filters.legacy_browsers import LegacyBrowsersFilter, IE8Filter
from sentry.testutils import TestCase


class LegacyBrowsersFilterTest(TestCase):
    filter_cls = LegacyBrowsersFilter

    def apply_filter(self, data):
        return self.filter_cls(self.project).test(data)

    def get_mock_data(self, user_agent):
        return {
            'platform': 'javascript',
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
                'method': 'GET',
                'headers': [
                    ['User-Agent', user_agent],
                ]
            }
        }

    def test_filters_ie_9(self):
        data = self.get_mock_data('Mozilla/5.0 (Windows; U; MSIE 9.0; WIndows NT 9.0; en-US))')
        assert self.apply_filter(data) is True

    def test_filters_ie_10(self):
        data = self.get_mock_data('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 7.0; InfoPath.3; .NET CLR 3.1.40767; Trident/6.0; en-IN)')
        assert self.apply_filter(data) is False

    def test_filters_opera_12(self):
        data = self.get_mock_data('Opera/9.80 (X11; Linux i686; Ubuntu/14.10) Presto/2.12.388 Version/12.16')
        assert self.apply_filter(data) is True

    def test_does_not_filter_chrome(self):
        data = self.get_mock_data('Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36')
        assert self.apply_filter(data) is False

    def test_does_not_filter_edge(self):
        data = self.get_mock_data('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10136')
        assert self.apply_filter(data) is False


class IE8FilterTest(TestCase):
    filter_cls = IE8Filter

    def apply_filter(self, data):
        return self.filter_cls(self.project).test(data)

    def get_mock_data(self, user_agent):
        return {
            'platform': 'javascript',
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
                'method': 'GET',
                'headers': [
                    ['User-Agent', user_agent],
                ]
            }
        }

    def test_filters_ie_8(self):
        data = self.get_mock_data('Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Win64; x64; Trident/4.0; .NET CLR 2.0.50727; SLCC2; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; MDDC; Tablet PC 2.0)')
        assert self.apply_filter(data) is True

    def test_does_not_filter_ie_9(self):
        data = self.get_mock_data('Mozilla/5.0 (Windows; U; MSIE 9.0; WIndows NT 9.0; en-US))')
        assert self.apply_filter(data) is False

    def test_does_not_filter_ie_10(self):
        data = self.get_mock_data('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 7.0; InfoPath.3; .NET CLR 3.1.40767; Trident/6.0; en-IN)')
        assert self.apply_filter(data) is False

    def test_does_not_filter_opera_12(self):
        data = self.get_mock_data('Opera/9.80 (X11; Linux i686; Ubuntu/14.10) Presto/2.12.388 Version/12.16')
        assert self.apply_filter(data) is False

    def test_does_not_filter_chrome(self):
        data = self.get_mock_data('Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36')
        assert self.apply_filter(data) is False

    def test_does_not_filter_edge(self):
        data = self.get_mock_data('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10136')
        assert self.apply_filter(data) is False
