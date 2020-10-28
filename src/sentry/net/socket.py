from __future__ import absolute_import

import six
import ipaddress
import socket
from sentry.utils.compat import functools
from ssl import wrap_socket
from six.moves.urllib.parse import urlparse

from django.conf import settings
from django.utils.encoding import force_text
from urllib3.util.connection import allowed_gai_family, _set_socket_options

from sentry.exceptions import RestrictedIPAddress


DISALLOWED_IPS = frozenset(
    ipaddress.ip_network(six.text_type(i), strict=False) for i in settings.SENTRY_DISALLOWED_IPS
)


@functools.lru_cache(maxsize=100)
def is_ipaddress_allowed(ip):
    """
    Test if a given IP address is allowed or not
    based on the DISALLOWED_IPS rules.
    """
    if not DISALLOWED_IPS:
        return True
    ip_address = ipaddress.ip_address(force_text(ip, strings_only=True))
    for ip_network in DISALLOWED_IPS:
        if ip_address in ip_network:
            return False
    return True


def ensure_fqdn(hostname):
    """
    If a given hostname is just an IP address, this is already qualified.
    If it's not, then it's a hostname and we want to ensure it's fully qualified
    by ending with a `.`.

    This is done so that we don't even attempt to use /etc/resolv.conf search domains.
    1) This is a performance benefit since we don't need to check anything else.
    2) This is a security issue so that an external domain name configured doesn't
       even attempt to be resolved over internal search domains.
    """
    if not settings.SENTRY_ENSURE_FQDN:
        return hostname

    hostname = force_text(hostname, strings_only=True)

    # Already fully qualified if it ends in a "."
    if hostname[-1:] == ".":
        return hostname

    try:
        ipaddress.ip_address(hostname)
        return hostname
    except ValueError:
        return hostname + "."


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

    hostname = ensure_fqdn(hostname)

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

    host = ensure_fqdn(host)

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
