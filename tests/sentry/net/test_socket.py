import socket
import time
from unittest.mock import MagicMock, patch

import pytest

from django.test import override_settings

from sentry.net.socket import (
    ensure_fqdn,
    is_ipaddress_allowed,
    is_safe_hostname,
    safe_create_connection,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_blocklist


class SocketTest(TestCase):
    @override_blocklist("10.0.0.0/8", "127.0.0.1")
    def test_is_ipaddress_allowed(self) -> None:
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("127.0.0.1") is False
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("10.0.1.1") is False
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("1.1.1.1") is True

    @override_blocklist("::ffff:10.0.0.0/104", "::1/128")
    def test_is_ipaddress_allowed_ipv6(self) -> None:
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("::1") is False
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("::ffff:10.0.1.2") is False
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("::ffff:1.1.1.1") is True
        is_ipaddress_allowed.cache_clear()
        assert is_ipaddress_allowed("2001:db8:a::123") is True

    @override_blocklist("10.0.0.0/8", "127.0.0.1")
    @patch("socket.getaddrinfo")
    def test_is_safe_hostname(self, mock_getaddrinfo: MagicMock) -> None:
        mock_getaddrinfo.return_value = [(2, 1, 6, "", ("81.0.0.1", 0))]
        assert is_safe_hostname("example.com") is True
        mock_getaddrinfo.return_value = [(2, 1, 6, "", ("127.0.0.1", 0))]
        assert is_safe_hostname("example.com") is False

    @override_settings(SENTRY_ENSURE_FQDN=True)
    def test_ensure_fqdn(self) -> None:
        assert ensure_fqdn("example.com") == "example.com."
        assert ensure_fqdn("127.0.0.1") == "127.0.0.1"
        assert ensure_fqdn("example.com.") == "example.com."

    @patch("sentry.net.socket.socket.socket")
    @patch("sentry.net.socket.socket.getaddrinfo")
    def test_safe_create_connection_times_out_on_slow_dns(
        self, mock_getaddrinfo: MagicMock, mock_socket_ctor: MagicMock
    ) -> None:
        def slow_lookup(*args, **kwargs):
            time.sleep(0.2)
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("1.1.1.1", 443))]

        mock_getaddrinfo.side_effect = slow_lookup
        mock_socket_ctor.return_value = MagicMock()

        with pytest.raises(socket.timeout):
            safe_create_connection(("example.com", 443), timeout=0.05)

        mock_socket_ctor.assert_not_called()

    @patch("sentry.net.socket.socket.socket")
    @patch("sentry.net.socket.socket.getaddrinfo")
    def test_safe_create_connection_uses_timeout_objects(
        self, mock_getaddrinfo: MagicMock, mock_socket_ctor: MagicMock
    ) -> None:
        from urllib3.util.timeout import Timeout

        def slow_lookup(*args, **kwargs):
            time.sleep(0.2)
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("1.1.1.1", 443))]

        mock_getaddrinfo.side_effect = slow_lookup
        mock_socket_ctor.return_value = MagicMock()

        with pytest.raises(socket.timeout):
            safe_create_connection(("example.com", 443), timeout=Timeout(connect=0.05))

        mock_socket_ctor.assert_not_called()
