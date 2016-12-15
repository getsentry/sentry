from __future__ import absolute_import

from sentry.filters.legacy_browsers import (LegacyBrowsersFilter,
    IE8Filter, IE9Filter, AndroidFilter, SafariFilter, OperaFilter)
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

    def test_filters_android_2(self):
        data = self.get_mock_data('Mozilla/5.0 (Linux; U; Android 2.3.5; en-us; HTC Vision Build/GRI40) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1')
        assert self.apply_filter(data) is True

    def test_does_not_filter_android_4(self):
        data = self.get_mock_data('Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.133 Mobile Safari/535.19')
        assert self.apply_filter(data) is False

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
        data = self.get_mock_data('Mozilla/5.0 (Windows; U; MSIE 9.0; Windows NT 9.0; en-US))')
        assert self.apply_filter(data) is False

    def test_does_not_filter_ie_10(self):
        data = self.get_mock_data('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 7.0; InfoPath.3; .NET CLR 3.1.40767; Trident/6.0; en-IN)')
        assert self.apply_filter(data) is False


class IE9FilterTest(TestCase):
    filter_cls = IE9Filter

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
        data = self.get_mock_data('Mozilla/4.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/4.0; .NET CLR 2.0.50727; SLCC2; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; MDDC; Tablet PC 2.0)')
        assert self.apply_filter(data) is True

    def test_does_not_filter_ie_8(self):
        data = self.get_mock_data('Mozilla/5.0 (Windows; U; MSIE 8.0; Windows NT 9.0; en-US))')
        assert self.apply_filter(data) is False

    def test_does_not_filter_ie_10(self):
        data = self.get_mock_data('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 7.0; InfoPath.3; .NET CLR 3.1.40767; Trident/6.0; en-IN)')
        assert self.apply_filter(data) is False


class AndroidFilterTest(TestCase):
    filter_cls = AndroidFilter

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

    def test_filters_android_2(self):
        data = self.get_mock_data('Mozilla/5.0 (Linux; U; Android 2.3.5; en-us; HTC Vision Build/GRI40) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1')
        assert self.apply_filter(data) is True

    def test_does_not_filter_android_4(self):
        data = self.get_mock_data('Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Build/IML74K) AppleWebkit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30')
        assert self.apply_filter(data) is False

    def test_does_not_filter_ie_10(self):
        data = self.get_mock_data('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 7.0; InfoPath.3; .NET CLR 3.1.40767; Trident/6.0; en-IN)')
        assert self.apply_filter(data) is False


class SafariFilterTest(TestCase):
    filter_cls = SafariFilter

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

    def test_filters_safari_5(self):
        data = self.get_mock_data('Mozilla/5.0 (Windows; U; Windows NT 6.1; zh-HK) AppleWebKit/533.18.1 (KHTML, like Gecko) Version/5.0.2 Safari/533.18.5')
        assert self.apply_filter(data) is True

    def test_does_not_filter_safari_7(self):
        data = self.get_mock_data('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A')
        assert self.apply_filter(data) is False

    def test_does_not_filter_ie_5(self):
        data = self.get_mock_data('Mozilla/4.0 (compatible; MSIE 5.50; Windows NT; SiteKiosk 4.9; SiteCoach 1.0)')
        assert self.apply_filter(data) is False


class OperaFilterTest(TestCase):
    filter_cls = OperaFilter

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

    def test_filters_opera_11(self):
        data = self.get_mock_data('Opera/9.80 (Windows NT 5.1; U; it) Presto/2.7.62 Version/11.00')
        assert self.apply_filter(data) is True

    def test_does_not_filter_opera_15(self):
        data = self.get_mock_data('Mozilla/5.0 (X11; Linux x86_64; Debian) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.52 Safari/537.36 OPR/15.0.1147.100')
        assert self.apply_filter(data) is False

    def test_does_not_filter_ie_10(self):
        data = self.get_mock_data('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 7.0; InfoPath.3; .NET CLR 3.1.40767; Trident/6.0; en-IN)')
        assert self.apply_filter(data) is False
