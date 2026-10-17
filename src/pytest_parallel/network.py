from __future__ import annotations

import ipaddress
import socket
import weakref
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any

_SOCKET_METHODS = (
    "accept",
    "bind",
    "connect",
    "connect_ex",
    "listen",
    "recv",
    "recv_into",
    "recvfrom",
    "recvfrom_into",
    "recvmsg",
    "recvmsg_into",
    "send",
    "sendall",
    "sendfile",
    "sendmsg",
    "sendto",
)
_RESOLVER_FUNCTIONS = (
    "getaddrinfo",
    "gethostbyaddr",
    "gethostbyname",
    "gethostbyname_ex",
    "getnameinfo",
)
_BLOCKED_MESSAGE = (
    "Network access outside loopback is disabled by pytest-parallel; "
    "use @pytest.mark.enable_network to allow it for this test"
)


@contextmanager
def network_blocked() -> Iterator[None]:
    originals: list[tuple[Any, str, Callable[..., Any]]] = []
    try:
        for name in _SOCKET_METHODS:
            original = getattr(socket.socket, name, None)
            if original is None:
                continue
            originals.append((socket.socket, name, original))
            setattr(socket.socket, name, _guard_network_operation(name, original))
        for name in _RESOLVER_FUNCTIONS:
            original = getattr(socket, name, None)
            if original is None:
                continue
            originals.append((socket, name, original))
            setattr(socket, name, _guard_resolver(name, original))
        yield
    finally:
        for owner, name, original in reversed(originals):
            setattr(owner, name, original)


_PEER_LOOPBACK: weakref.WeakKeyDictionary[socket.socket, bool] = weakref.WeakKeyDictionary()
_HOT_METHODS = frozenset(
    {
        "recv",
        "recv_into",
        "recvfrom",
        "recvfrom_into",
        "recvmsg",
        "recvmsg_into",
        "send",
        "sendall",
        "sendfile",
        "sendmsg",
        "sendto",
    }
)


def _explicit_send_address(name: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> Any:
    if name == "sendto":
        if "address" in kwargs:
            return kwargs["address"]
        if len(args) >= 2:
            return args[-1]
        return None
    if name == "sendmsg":
        if "address" in kwargs:
            return kwargs["address"]
        if len(args) >= 4:
            return args[3]
        return None
    return None


def _guard_network_operation(name: str, original: Callable[..., Any]) -> Callable[..., Any]:
    def guarded(sock: socket.socket, *args: Any, **kwargs: Any) -> Any:
        if sock.family == getattr(socket, "AF_UNIX", None):
            return original(sock, *args, **kwargs)
        if name in _HOT_METHODS and _explicit_send_address(name, args, kwargs) is None:
            cached = _PEER_LOOPBACK.get(sock)
            if cached is not None:
                if not cached:
                    raise PermissionError(_BLOCKED_MESSAGE)
                return original(sock, *args, **kwargs)
        if not _targets_loopback(sock, name, args, kwargs):
            raise PermissionError(_BLOCKED_MESSAGE)
        result = original(sock, *args, **kwargs)
        if name in {"connect", "connect_ex"}:
            try:
                peer = sock.getpeername()
                host = peer[0] if isinstance(peer, tuple) and peer else peer
                _PEER_LOOPBACK[sock] = _is_loopback_host(host) or _is_local_hostname(host)
            except OSError:
                pass
        elif name == "accept" and isinstance(result, tuple) and result:
            accepted = result[0]
            if isinstance(accepted, socket.socket):
                try:
                    peer = accepted.getpeername()
                    host = peer[0] if isinstance(peer, tuple) and peer else peer
                    _PEER_LOOPBACK[accepted] = _is_loopback_host(host) or _is_local_hostname(host)
                except OSError:
                    pass
        return result

    return guarded


def _targets_loopback(
    sock: socket.socket,
    name: str,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
) -> bool:
    if sock.family == getattr(socket, "AF_UNIX", None):
        return True

    address = None
    if name in {"bind", "connect", "connect_ex"}:
        address = args[0] if args else kwargs.get("address")
    elif name == "sendto":
        address = kwargs.get("address", args[-1] if len(args) >= 2 else None)
    elif name == "sendmsg" and (len(args) >= 4 or "address" in kwargs):
        address = args[3] if len(args) >= 4 else kwargs["address"]
    elif name in {"accept", "listen"}:
        try:
            address = sock.getsockname()
        except OSError:
            return False
    elif name in {"recv", "recv_into", "recvfrom", "recvfrom_into", "recvmsg", "recvmsg_into"}:
        try:
            address = sock.getpeername()
        except OSError:
            try:
                address = sock.getsockname()
            except OSError:
                return False
    else:
        try:
            address = sock.getpeername()
        except OSError:
            return False

    if isinstance(address, tuple) and address:
        host = address[0]
    elif isinstance(address, str):
        host = address
    else:
        return False

    if name in {"bind", "listen", "accept"} and _is_unspecified_host(host):
        return True
    return _is_loopback_host(host) or _is_local_hostname(host)


def _guard_resolver(name: str, original: Callable[..., Any]) -> Callable[..., Any]:
    def guarded(*args: Any, **kwargs: Any) -> Any:
        address = args[0] if args else kwargs.get("host", kwargs.get("sockaddr"))
        if name == "getnameinfo":
            address = args[0] if args else kwargs.get("sockaddr")
            if isinstance(address, tuple) and address:
                address = address[0]
        if address is None or (isinstance(address, (str, bytes)) and not address):
            return original(*args, **kwargs)
        if (
            _is_loopback_host(address)
            or _is_unspecified_host(address)
            or _is_local_hostname(address)
        ):
            return original(*args, **kwargs)
        raise PermissionError(_BLOCKED_MESSAGE)

    return guarded


def _is_unspecified_host(host: Any) -> bool:
    if isinstance(host, bytes):
        try:
            host = host.decode("ascii")
        except UnicodeDecodeError:
            return False
    if not isinstance(host, str):
        return False
    try:
        return ipaddress.ip_address(host).is_unspecified
    except ValueError:
        return False


def _is_local_hostname(host: Any) -> bool:
    if isinstance(host, bytes):
        try:
            host = host.decode("ascii")
        except UnicodeDecodeError:
            return False
    if not isinstance(host, str) or not host:
        return False
    try:
        local = socket.gethostname()
    except OSError:
        return False
    folded = host.casefold().rstrip(".")
    return bool(local) and folded in {local.casefold(), local.casefold().split(".")[0]}


def _is_loopback_host(host: Any) -> bool:
    if isinstance(host, bytes):
        try:
            host = host.decode("ascii")
        except UnicodeDecodeError:
            return False
    if not isinstance(host, str):
        return False
    if host.casefold() in {"localhost", "localhost."}:
        return True
    try:
        address = ipaddress.ip_address(host)
        return address.is_loopback or (
            isinstance(address, ipaddress.IPv6Address)
            and address.ipv4_mapped is not None
            and address.ipv4_mapped.is_loopback
        )
    except ValueError:
        return False
