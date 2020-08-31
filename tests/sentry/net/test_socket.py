from __future__ import absolute_import

import pytest
from sentry.utils.compat.mock import patch
from django.core.exceptions import SuspiciousOperation
from django.test import override_settings

from sentry.testutils import TestCase
from sentry.testutils.helpers import override_blacklist

from sentry.net.socket import (
    is_ipaddress_allowed,
    is_safe_hostname,
    safe_socket_connect,
    ensure_fqdn,
)


class SocketTest(TestCase):
    @override_blacklist("10.0.0.0/8", "127.0.0.1")
    def test_is_ipaddress_allowed(self):
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("127.0.0.1") is False
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("10.0.1.1") is False
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("1.1.1.1") is True

    @override_blacklist("10.0.0.0/8", "127.0.0.1")
    @patch("socket.getaddrinfo")
    def test_is_safe_hostname(self, mock_getaddrinfo):
        mock_getaddrinfo.return_value = [(2, 1, 6, "", ("81.0.0.1", 0))]
        assert is_safe_hostname("example.com") is True
        mock_getaddrinfo.return_value = [(2, 1, 6, "", ("127.0.0.1", 0))]
        assert is_safe_hostname("example.com") is False

    @override_blacklist("127.0.0.1")
    def test_safe_socket_connect(self):
        with pytest.raises(SuspiciousOperation):
            safe_socket_connect(("127.0.0.1", 80))

    @override_settings(SENTRY_ENSURE_FQDN=True)
    def test_ensure_fqdn(self):
        assert ensure_fqdn("example.com") == "example.com."
        assert ensure_fqdn("127.0.0.1") == "127.0.0.1"
        assert ensure_fqdn("example.com.") == "example.com."
