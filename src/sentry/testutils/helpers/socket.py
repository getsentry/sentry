import ipaddress
from contextlib import contextmanager

from sentry.net import socket as net_socket

__all__ = ["override_blacklist"]


@contextmanager
def override_blacklist(*ip_addresses):
    disallowed_ips = frozenset(net_socket.DISALLOWED_IPS)
    net_socket.DISALLOWED_IPS = frozenset(ipaddress.ip_network(str(ip)) for ip in ip_addresses)
    try:
        yield
    finally:
        net_socket.DISALLOWED_IPS = disallowed_ips
        # We end up caching these disallowed ips on this function, so
        # make sure we clear the cache as part of cleanup
        net_socket.is_ipaddress_allowed.cache_clear()
