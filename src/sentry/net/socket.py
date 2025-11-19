from __future__ import annotations

import functools
import ipaddress
import os
import socket
import threading
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from socket import timeout as SocketTimeout
from typing import TYPE_CHECKING
from urllib.parse import urlparse

from django.conf import settings
from django.utils.encoding import force_str
from urllib3.exceptions import LocationParseError
from urllib3.util.connection import _set_socket_options, allowed_gai_family
from urllib3.util.timeout import Timeout, _DEFAULT_TIMEOUT, _TYPE_DEFAULT

from sentry.exceptions import RestrictedIPAddress

if TYPE_CHECKING:
    from sentry.net.http import IsIpAddressPermitted

DISALLOWED_IPS = frozenset(
    ipaddress.ip_network(str(i), strict=False) for i in settings.SENTRY_DISALLOWED_IPS
)

_DNS_THREADPOOL_LOCK = threading.Lock()
_DNS_THREADPOOL: ThreadPoolExecutor | None = None
_DNS_THREADPOOL_PID: int | None = None
_DNS_THREADPOOL_SIZE = max(1, getattr(settings, "SENTRY_DNS_RESOLUTION_MAX_WORKERS", 4))


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


def _get_dns_executor() -> ThreadPoolExecutor:
    global _DNS_THREADPOOL, _DNS_THREADPOOL_PID
    pid = os.getpid()
    if _DNS_THREADPOOL is None or _DNS_THREADPOOL_PID != pid:
        with _DNS_THREADPOOL_LOCK:
            if _DNS_THREADPOOL is not None and _DNS_THREADPOOL_PID != pid:
                _DNS_THREADPOOL.shutdown(wait=False)
                _DNS_THREADPOOL = None
            if _DNS_THREADPOOL is None:
                _DNS_THREADPOOL = ThreadPoolExecutor(
                    max_workers=_DNS_THREADPOOL_SIZE, thread_name_prefix="dns-resolver"
                )
                _DNS_THREADPOOL_PID = pid
    return _DNS_THREADPOOL


def _as_float_timeout(value: object) -> float | None:
    if value is None or value is _DEFAULT_TIMEOUT:
        return None
    try:
        timeout_value = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return timeout_value


def _extract_connect_timeout(timeout: _TYPE_DEFAULT | float | Timeout | None) -> float | None:
    if timeout is None or timeout is _DEFAULT_TIMEOUT:
        return None

    if isinstance(timeout, Timeout):
        connect_timeout_bound = timeout.connect_timeout
        if callable(connect_timeout_bound):
            connect_timeout_bound = connect_timeout_bound()
        return _as_float_timeout(connect_timeout_bound)

    if hasattr(timeout, "connect_timeout"):
        connect_timeout_bound = getattr(timeout, "connect_timeout")
        if callable(connect_timeout_bound):
            connect_timeout_bound = connect_timeout_bound()
        return _as_float_timeout(connect_timeout_bound)

    return _as_float_timeout(timeout)


def _resolve_addrinfo_with_timeout(
    host: str, port: int, family: int, timeout: _TYPE_DEFAULT | float | Timeout | None
) -> list[tuple[int, int, int, str, tuple[str, int]]]:
    connect_timeout = _extract_connect_timeout(timeout)
    if connect_timeout is None:
        return socket.getaddrinfo(host, port, family, socket.SOCK_STREAM)

    if connect_timeout <= 0:
        raise SocketTimeout(f"timed out while resolving DNS for {host}")

    executor = _get_dns_executor()
    future = executor.submit(socket.getaddrinfo, host, port, family, socket.SOCK_STREAM)
    try:
        return future.result(connect_timeout)
    except FuturesTimeoutError as exc:
        future.cancel()
        raise SocketTimeout(f"timed out while resolving DNS for {host}") from exc


# Modifed version of urllib3.util.connection.create_connection.
def safe_create_connection(
    address: tuple[str, int],
    timeout: _TYPE_DEFAULT | float | None = _DEFAULT_TIMEOUT,
    source_address: str | None = None,
    socket_options: Sequence[tuple[int, int, int | bytes]] | None = None,
    is_ipaddress_permitted: IsIpAddressPermitted = None,
) -> socket.socket:
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

    for res in _resolve_addrinfo_with_timeout(host, port, family, timeout):
        af, socktype, proto, canonname, sa = res

        # Begin custom code.
        ip = sa[0]
        assert isinstance(ip, str), ip  # we aren't running ipv6-disabled python
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

            if timeout is not _DEFAULT_TIMEOUT:
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
