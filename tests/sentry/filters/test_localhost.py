from __future__ import absolute_import

from sentry.filters.localhost import LocalhostFilter
from sentry.testutils import TestCase


class LocalhostFilterTest(TestCase):
    filter_cls = LocalhostFilter

    def apply_filter(self, data):
        return self.filter_cls(self.project).test(data)

    def get_mock_data(self, client_ip=None, url=None):
        return {
            'user': {
                'ip_address': client_ip,
            },
            'request': {
                'url': url,
            }
        }

    def test_filters_localhost_ipv4(self):
        data = self.get_mock_data('127.0.0.1')
        assert self.apply_filter(data)

    def test_filters_localhost_ipv6(self):
        data = self.get_mock_data('::1')
        assert self.apply_filter(data)

    def test_does_not_filter_external_ip(self):
        data = self.get_mock_data('74.1.3.56')
        assert not self.apply_filter(data)

    def test_fails_gracefully_without_user(self):
        assert not self.apply_filter({})

    def test_filters_localhost_domain(self):
        data = self.get_mock_data(url='http://localhost/something.html')
        assert self.apply_filter(data)

        data = self.get_mock_data(url='http://localhost:9000/')
        assert self.apply_filter(data)

        data = self.get_mock_data(url='https://localhost')
        assert self.apply_filter(data)

        data = self.get_mock_data(url='https://127.0.0.1')
        assert self.apply_filter(data)

    def test_does_not_filter_non_localhost_domain(self):
        data = self.get_mock_data(url='https://getsentry.com/')
        assert not self.apply_filter(data)

        data = self.get_mock_data(url='http://example.com/index.html?domain=localhost')
        assert not self.apply_filter(data)
