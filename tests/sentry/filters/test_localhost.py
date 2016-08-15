from __future__ import absolute_import

from sentry.filters.localhost import LocalhostFilter
from sentry.testutils import TestCase


class LocalhostFilterTest(TestCase):
    filter_cls = LocalhostFilter

    def apply_filter(self, data):
        return self.filter_cls(self.project).test(data)

    def get_mock_data(self, client_ip=None):
        return {
            'sentry.interfaces.User': {
                'ip_address': client_ip,
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
