from __future__ import absolute_import

import six
import ipaddress
import socket
from functools32 import lru_cache
from ssl import wrap_socket
from six.moves.urllib.parse import urlparse

from django.conf import settings
from urllib3.util.connection import allowed_gai_family, _set_socket_options

from sentry.exceptions import RestrictedIPAddress


DISALLOWED_IPS = frozenset(
    ipaddress.ip_network(six.text_type(i), strict=False) for i in settings.SENTRY_DISALLOWED_IPS
)


@lru_cache(maxsize=100)
def is_ipaddress_allowed(ip):
    """
    Test if a given IP address is allowed or not
    based on the DISALLOWED_IPS rules.
    """
    if not DISALLOWED_IPS:
        return True
    if isinstance(ip, six.binary_type):
        ip = ip.decode()
    ip_address = ipaddress.ip_address(ip)
    for ip_network in DISALLOWED_IPS:
        if ip_address in ip_network:
            return False
    return True


def is_valid_url(url):
    """
    Tests a URL to ensure it doesn't appear to be a blacklisted IP range.
    """
    return is_safe_hostname(urlparse(url).hostname)


def is_safe_hostname(hostname):
    """
    Tests a hostname to ensure it doesn't appear to be a blacklisted IP range.
    """
    # If we have no disallowed ips, we can skip any further validation
    # and there's no point in doing a DNS lookup to validate against
    # an empty list.
    if not DISALLOWED_IPS:
        return True

    if not hostname:
        return False

    # Using the value from allowed_gai_family() in the context of getaddrinfo lets
    # us select whether to work with IPv4 DNS records, IPv6 records, or both.
    # The original create_connection function always returns all records.
    family = allowed_gai_family()

    try:
        for _, _, _, _, address in socket.getaddrinfo(hostname, 0, family, socket.SOCK_STREAM):
            # Only one bad apple will spoil the entire lookup, so be nice.
            if not is_ipaddress_allowed(address[0]):
                return False
    except socket.gaierror:
        # If we fail to resolve, automatically bad
        return False

    return True


# Mostly yanked from https://github.com/urllib3/urllib3/blob/1.22/urllib3/util/connection.py#L36
def safe_create_connection(
    address, timeout=socket._GLOBAL_DEFAULT_TIMEOUT, source_address=None, socket_options=None
):
    host, port = address
    if host.startswith("["):
        host = host.strip("[]")
    err = None

    # Using the value from allowed_gai_family() in the context of getaddrinfo lets
    # us select whether to work with IPv4 DNS records, IPv6 records, or both.
    # The original create_connection function always returns all records.
    family = allowed_gai_family()

    for res in socket.getaddrinfo(host, port, family, socket.SOCK_STREAM):
        af, socktype, proto, canonname, sa = res

        # HACK(mattrobenolt): This is the only code that diverges
        ip = sa[0]
        if not is_ipaddress_allowed(ip):
            # I am explicitly choosing to be overly aggressive here. This means
            # the first IP that matches that hits our restricted set of IP networks,
            # we reject all records. In theory, there might be IP addresses that
            # are safe, but if one record is straddling safe and unsafe IPs, it's
            # suspicious.
            if host == ip:
                raise RestrictedIPAddress("(%s) matches the URL blacklist" % ip)
            raise RestrictedIPAddress("(%s/%s) matches the URL blacklist" % (host, ip))

        sock = None
        try:
            sock = socket.socket(af, socktype, proto)

            # If provided, set socket level options before connecting.
            _set_socket_options(sock, socket_options)

            if timeout is not socket._GLOBAL_DEFAULT_TIMEOUT:
                sock.settimeout(timeout)
            if source_address:
                sock.bind(source_address)
            sock.connect(sa)
            return sock

        except socket.error as e:
            err = e
            if sock is not None:
                sock.close()
                sock = None

    if err is not None:
        raise err

    raise socket.error("getaddrinfo returns an empty list")


def safe_socket_connect(address, timeout=30, ssl=False):
    """
    Creates a socket and connects to address, but prevents connecting to
    our disallowed IP blocks.
    """
    sock = safe_create_connection(address, timeout)
    if ssl:
        sock = wrap_socket(sock)
    return sock
