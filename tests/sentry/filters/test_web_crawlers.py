from __future__ import absolute_import

from sentry.filters.web_crawlers import WebCrawlersFilter
from sentry.testutils import TestCase


class WebCrawlersFilterTest(TestCase):
    filter_cls = WebCrawlersFilter

    def apply_filter(self, data):
        return self.filter_cls(self.project).test(data)

    def get_mock_data(self, user_agent):
        return {
            'sentry.interfaces.Http': {
                'url': 'http://example.com',
                'method': 'GET',
                'headers': [
                    ['User-Agent', user_agent],
                ]
            }
        }

    def test_filters_googlebot(self):
        data = self.get_mock_data('Googlebot')
        assert self.apply_filter(data)

    def test_does_not_filter_chrome(self):
        data = self.get_mock_data('Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36')
        assert not self.apply_filter(data)
