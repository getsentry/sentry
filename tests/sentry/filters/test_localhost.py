from __future__ import absolute_import

from sentry.message_filters import _localhost_filter
from sentry.relay.config import ProjectConfig
from sentry.testutils import TestCase


class LocalhostFilterTest(TestCase):
    def apply_filter(self, data):
        project_config = ProjectConfig(self.project)
        return _localhost_filter(project_config, data)

    def get_mock_data(self, client_ip=None, url=None):
        return {"user": {"ip_address": client_ip}, "request": {"url": url}}

    def test_filters_localhost_ipv4(self):
        data = self.get_mock_data("127.0.0.1")
        assert self.apply_filter(data)

    def test_filters_localhost_ipv6(self):
        data = self.get_mock_data("::1")
        assert self.apply_filter(data)

    def test_does_not_filter_external_ip(self):
        data = self.get_mock_data("74.1.3.56")
        assert not self.apply_filter(data)

    def test_fails_gracefully_without_user(self):
        assert not self.apply_filter({})

    def test_filters_localhost_domain(self):
        data = self.get_mock_data(url="http://localhost/something.html")
        assert self.apply_filter(data)

        data = self.get_mock_data(url="http://localhost:9000/")
        assert self.apply_filter(data)

        data = self.get_mock_data(url="https://localhost")
        assert self.apply_filter(data)

        data = self.get_mock_data(url="https://127.0.0.1")
        assert self.apply_filter(data)

    def test_does_not_filter_non_localhost_domain(self):
        data = self.get_mock_data(url="https://getsentry.com/")
        assert not self.apply_filter(data)

        data = self.get_mock_data(url="http://example.com/index.html?domain=localhost")
        assert not self.apply_filter(data)
