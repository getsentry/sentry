from __future__ import annotations

import functools
import ipaddress
import socket
from typing import TYPE_CHECKING
from urllib.parse import urlparse

from django.conf import settings
from django.utils.encoding import force_str
from urllib3.exceptions import LocationParseError
from urllib3.util.connection import _set_socket_options, allowed_gai_family

from sentry.exceptions import RestrictedIPAddress

if TYPE_CHECKING:
    from sentry.net.http import IsIpAddressPermitted

DISALLOWED_IPS = frozenset(
    ipaddress.ip_network(str(i), strict=False) for i in settings.SENTRY_DISALLOWED_IPS
)


@functools.lru_cache(maxsize=100)
def is_ipaddress_allowed(ip: str) -> bool:
    """
    Test if a given IP address is allowed or not
    based on the DISALLOWED_IPS rules.
    """
    if not DISALLOWED_IPS:
        return True
    ip_address = ipaddress.ip_address(force_str(ip, strings_only=True))
    for ip_network in DISALLOWED_IPS:
        if ip_address in ip_network:
            return False
    return True


def ensure_fqdn(hostname: str) -> str:
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

    hostname = force_str(hostname, strings_only=True)

    # Already fully qualified if it ends in a "."
    if hostname[-1:] == ".":
        return hostname

    try:
        ipaddress.ip_address(hostname)
        return hostname
    except ValueError:
        return hostname + "."


def is_valid_url(url: str) -> bool:
    """
    Tests a URL to ensure it doesn't appear to be a blacklisted IP range.
    """
    return is_safe_hostname(urlparse(url).hostname)


def is_safe_hostname(hostname: str | None) -> bool:
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
    except (socket.gaierror, UnicodeError):
        # If we fail to resolve, automatically bad
        return False

    return True


# Modifed version of urllib3.util.connection.create_connection.
def safe_create_connection(
    address,
    timeout=socket._GLOBAL_DEFAULT_TIMEOUT,
    source_address=None,
    socket_options=None,
    is_ipaddress_permitted: IsIpAddressPermitted = None,
):
    if is_ipaddress_permitted is None:
        is_ipaddress_permitted = is_ipaddress_allowed

    host, port = address
    if host.startswith("["):
        host = host.strip("[]")
    err = None

    # Using the value from allowed_gai_family() in the context of getaddrinfo lets
    # us select whether to work with IPv4 DNS records, IPv6 records, or both.
    # The original create_connection function always returns all records.
    family = allowed_gai_family()

    # Begin custom code.
    host = ensure_fqdn(host)
    # End custom code.

    try:
        host.encode("idna")
    except UnicodeError:
        raise LocationParseError("'{host}', label empty or too long") from None

    for res in socket.getaddrinfo(host, port, family, socket.SOCK_STREAM):
        af, socktype, proto, canonname, sa = res

        # Begin custom code.
        ip = sa[0]
        if not is_ipaddress_permitted(ip):
            # I am explicitly choosing to be overly aggressive here. This means
            # the first IP that matches that hits our restricted set of IP networks,
            # we reject all records. In theory, there might be IP addresses that
            # are safe, but if one record is straddling safe and unsafe IPs, it's
            # suspicious.
            if host == ip:
                raise RestrictedIPAddress(f"({ip}) matches the URL blocklist")
            raise RestrictedIPAddress(f"({host}/{ip}) matches the URL blocklist")
        # End custom code.

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

        except OSError as e:
            err = e
            if sock is not None:
                sock.close()
                sock = None

    if err is not None:
        raise err

    raise OSError("getaddrinfo returns an empty list")
