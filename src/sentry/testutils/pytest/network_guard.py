"""Guard tests against reaching the outside world over the network.

Tests that talk to real external hosts are slow and flaky, and they can leak
data. This plugin patches the Python-level socket entry points that establish
outbound traffic and checks each destination against an allowlist of local
targets: loopback, the unspecified address, the local hostname, the docker
bridge gateway that CI binds the live server to, and the hosts of the DSNs that
test infrastructure itself reports to.

``SENTRY_NETWORK_GUARD`` selects the mode:

- ``off``: nothing is patched. The default outside CI.
- ``report``: blocked attempts are recorded and still allowed, then written to
  ``.artifacts/network-guard.json`` and summarized at the end of the session.
  The default in CI.
- ``strict``: blocked attempts raise :class:`NetworkAccessBlocked`.

``SENTRY_NETWORK_GUARD_ALLOW`` takes extra comma-separated hosts or IPs to allow,
for local setups that run services somewhere other than loopback.

Mark a test with ``@pytest.mark.enable_network(reason=...)`` when it really
needs the network.

Only connection establishment is checked (``connect``, ``connect_ex``, and
``sendto``/``sendmsg`` with an explicit address) plus the resolver functions.
``send``/``recv`` are left alone: a socket can only reach a peer it connected
to, and wrapping them would add a Python call to every redis or HTTP round-trip.
Clients implemented in C (psycopg2/libpq, confluent-kafka/librdkafka, grpc core,
c-ares) open their own sockets and are invisible to this guard.
"""

from __future__ import annotations

import ipaddress
import os
import socket
import sys
import sysconfig
import threading
from collections.abc import Callable, Generator
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import orjson
import pytest

MODE_ENV = "SENTRY_NETWORK_GUARD"
ALLOW_ENV = "SENTRY_NETWORK_GUARD_ALLOW"
REPORT_ENV = "SENTRY_NETWORK_GUARD_REPORT"
MARKER = "enable_network"
MODES = ("off", "report", "strict")

_MAX_RECORDS = 5000
_WORKEROUTPUT_KEY = "sentry_network_guard"
_INET_FAMILIES = frozenset((socket.AF_INET, socket.AF_INET6))
_STDLIB_DIR = sysconfig.get_paths()["stdlib"]
_THIS_FILE = __file__


class NetworkAccessBlocked(PermissionError):
    pass


def _get_mode() -> str:
    default = "report" if os.environ.get("CI") else "off"
    mode = os.environ.get(MODE_ENV, default).strip().lower() or default
    if mode not in MODES:
        raise pytest.UsageError(f"{MODE_ENV} must be one of {', '.join(MODES)}, got {mode!r}")
    return mode


_mode = "off"
# The nodeid of the test whose setup, call, or teardown is running, or None
# when nothing is being guarded. Read by every thread so that work a test hands
# to a thread pool is still attributed to it.
_current_nodeid: str | None = None
_allowed_hostnames: set[str] = set()
_allowed_ips: set[str] = set()
# Hosts already checked and allowed. Saves the ipaddress parse on repeat connects.
_allowed_cache: set[str] = set()
_names_by_ip: dict[str, str] = {}
_records: dict[tuple[str, str, str], dict[str, Any]] = {}
_records_lock = threading.Lock()
_originals: list[tuple[Any, str, Any]] = []
_merged_key = pytest.StashKey[list[dict[str, Any]]]()


def _dsn_host(dsn: str | None) -> str | None:
    if not dsn:
        return None
    return urlsplit(dsn).hostname


def _live_server_host() -> str | None:
    # pytest-django accepts "host", "host:port", or "host:port-range".
    address = os.environ.get("DJANGO_LIVE_TEST_SERVER_ADDRESS", "").strip()
    if not address:
        return None
    if address.count(":") == 1:
        address = address.split(":", 1)[0]
    return address.strip("[]")


def _build_allowlist() -> None:
    from sentry.testutils.thread_leaks.sentry import THREAD_LEAK_DSN

    hosts = {"localhost", "localhost.localdomain"}
    try:
        hostname = socket.gethostname()
    except OSError:
        hostname = ""
    if hostname:
        hosts.add(hostname)
        hosts.add(hostname.split(".", 1)[0])

    # Test infrastructure reports failures and thread leaks to Sentry itself.
    for dsn in (os.environ.get("PYTEST_SENTRY_DSN"), THREAD_LEAK_DSN):
        if dsn_host := _dsn_host(dsn):
            hosts.add(dsn_host)

    # CI binds the live server to the docker bridge gateway so that containers
    # such as Relay and Symbolicator can call back into it.
    if live_server_host := _live_server_host():
        hosts.add(live_server_host)

    for extra in os.environ.get(ALLOW_ENV, "").split(","):
        if extra := extra.strip():
            hosts.add(extra)

    for host in hosts:
        folded = host.casefold().rstrip(".")
        try:
            _allowed_ips.add(str(_parse_ip(folded)))
        except ValueError:
            _allowed_hostnames.add(folded)


def _parse_ip(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    ip = ipaddress.ip_address(host.split("%", 1)[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return ip.ipv4_mapped
    return ip


def _host_allowed(host: str) -> bool:
    if host in _allowed_cache:
        return True
    folded = host.casefold().rstrip(".")
    if folded in _allowed_hostnames:
        allowed = True
    else:
        try:
            ip = _parse_ip(folded)
        except ValueError:
            allowed = False
        else:
            # Connecting to the unspecified address reaches the local host on
            # Linux and macOS. The redis-cluster test config relies on it.
            allowed = ip.is_loopback or ip.is_unspecified or str(ip) in _allowed_ips
    if allowed:
        _allowed_cache.add(host)
    return allowed


def _as_host(value: Any) -> str | None:
    if isinstance(value, bytes):
        try:
            return value.decode("ascii")
        except UnicodeDecodeError:
            return None
    if isinstance(value, str):
        return value
    return None


def _origin() -> list[str]:
    """Return the innermost project frames plus the library that opened the socket."""
    frames: list[str] = []
    library: str | None = None
    frame: Any = sys._getframe(1)
    while frame is not None and len(frames) < 4:
        filename = frame.f_code.co_filename
        if filename == _THIS_FILE:
            pass
        elif "site-packages" in filename:
            if library is None:
                library = filename.split("site-packages/", 1)[1]
                library = f"{library}:{frame.f_lineno}"
        elif not filename.startswith(_STDLIB_DIR) and not filename.startswith("<"):
            frames.append(f"{_relpath(filename)}:{frame.f_lineno} in {frame.f_code.co_name}")
        frame = frame.f_back
    if library is not None:
        frames.append(f"via {library}")
    return frames


def _relpath(filename: str) -> str:
    for marker in ("/src/sentry/", "/tests/", "/getsentry/"):
        index = filename.rfind(marker)
        if index != -1:
            return filename[index + 1 :]
    return filename


def _blocked(nodeid: str, kind: str, target: str) -> None:
    key = (nodeid, kind, target)
    with _records_lock:
        record = _records.get(key)
        if record is not None:
            record["count"] += 1
        elif len(_records) < _MAX_RECORDS:
            _records[key] = {
                "nodeid": nodeid,
                "kind": kind,
                "target": target,
                "count": 1,
                "thread": threading.current_thread().name,
                "origin": _origin(),
            }
    if _mode == "strict":
        raise NetworkAccessBlocked(
            f"Network access to {target} ({kind}) is blocked during tests. "
            "Mock it (for example with `responses`), or mark the test with "
            f"@pytest.mark.{MARKER}(reason=...) if it really needs the network."
        )


def _check_address(sock: socket.socket, address: Any, kind: str) -> None:
    nodeid = _current_nodeid
    if nodeid is None or type(address) is not tuple or not address:
        return
    host = address[0]
    if not isinstance(host, str) or _host_allowed(host):
        return
    if sock.family not in _INET_FAMILIES:
        return
    port = address[1] if len(address) > 1 else "?"
    name = _names_by_ip.get(host)
    target = f"{name} ({host}):{port}" if name else f"{host}:{port}"
    _blocked(nodeid, kind, target)


def _guard_connect(original: Callable[..., Any]) -> Callable[..., Any]:
    def connect(self: socket.socket, address: Any) -> Any:
        _check_address(self, address, "connect")
        return original(self, address)

    return connect


def _guard_sendto(original: Callable[..., Any]) -> Callable[..., Any]:
    def sendto(self: socket.socket, *args: Any) -> Any:
        if len(args) >= 2:
            _check_address(self, args[-1], "sendto")
        return original(self, *args)

    return sendto


def _guard_sendmsg(original: Callable[..., Any]) -> Callable[..., Any]:
    def sendmsg(self: socket.socket, *args: Any) -> Any:
        if len(args) >= 4:
            _check_address(self, args[3], "sendmsg")
        return original(self, *args)

    return sendmsg


def _is_numeric_host(host: str) -> bool:
    try:
        _parse_ip(host)
    except ValueError:
        pass
    else:
        return True
    # The resolver parses legacy IPv4 forms such as "2130706433" or
    # "0177.0.0.1" with inet_aton and sends no DNS query for them.
    try:
        socket.inet_aton(host)
    except (OSError, ValueError):
        return False
    return True


def _check_resolve(kind: str, host: str | None) -> bool:
    """Return whether the lookup is for a non-local host that was let through."""
    nodeid = _current_nodeid
    if nodeid is None or not host or _host_allowed(host):
        return False
    if kind != "gethostbyaddr" and kind != "getnameinfo" and _is_numeric_host(host):
        return False  # a numeric address needs no lookup; the connect is checked
    _blocked(nodeid, kind, host)
    return True


def _remember(host: str | None, infos: Any) -> None:
    # Name the IPs of reported lookups, so the connect that follows is readable.
    if not host:
        return
    for info in infos:
        ip = info[4][0]
        if isinstance(ip, str):
            _names_by_ip.setdefault(ip, host)


def _guard_getaddrinfo(original: Callable[..., Any]) -> Callable[..., Any]:
    def getaddrinfo(host: Any, *args: Any, **kwargs: Any) -> Any:
        name = _as_host(host)
        reported = _check_resolve("getaddrinfo", name)
        infos = original(host, *args, **kwargs)
        if name and _current_nodeid is not None:
            folded = name.casefold().rstrip(".")
            if folded in _allowed_hostnames:
                for info in infos:
                    if isinstance(info[4][0], str):
                        _allowed_ips.add(str(_parse_ip(info[4][0])))
            elif reported:
                _remember(name, infos)
        return infos

    return getaddrinfo


def _guard_host_lookup(kind: str, original: Callable[..., Any]) -> Callable[..., Any]:
    def lookup(host: Any, *args: Any, **kwargs: Any) -> Any:
        _check_resolve(kind, _as_host(host))
        return original(host, *args, **kwargs)

    return lookup


def _guard_getnameinfo(original: Callable[..., Any]) -> Callable[..., Any]:
    def getnameinfo(sockaddr: Any, flags: int) -> Any:
        if not flags & socket.NI_NUMERICHOST and type(sockaddr) is tuple and sockaddr:
            _check_resolve("getnameinfo", _as_host(sockaddr[0]))
        return original(sockaddr, flags)

    return getnameinfo


def _patch(owner: Any, name: str, wrapper: Callable[..., Any]) -> None:
    original = getattr(owner, name, None)
    if original is None:
        return
    _originals.append((owner, name, original))
    setattr(owner, name, wrapper)


def install() -> None:
    _build_allowlist()
    _patch(socket.socket, "connect", _guard_connect(socket.socket.connect))
    _patch(socket.socket, "connect_ex", _guard_connect(socket.socket.connect_ex))
    _patch(socket.socket, "sendto", _guard_sendto(socket.socket.sendto))
    if hasattr(socket.socket, "sendmsg"):
        _patch(socket.socket, "sendmsg", _guard_sendmsg(socket.socket.sendmsg))
    _patch(socket, "getaddrinfo", _guard_getaddrinfo(socket.getaddrinfo))
    for name in ("gethostbyname", "gethostbyname_ex", "gethostbyaddr"):
        _patch(socket, name, _guard_host_lookup(name, getattr(socket, name)))
    _patch(socket, "getnameinfo", _guard_getnameinfo(socket.getnameinfo))


def uninstall() -> None:
    while _originals:
        owner, name, original = _originals.pop()
        setattr(owner, name, original)


def get_records() -> list[dict[str, Any]]:
    with _records_lock:
        return [dict(record) for record in _records.values()]


def pytest_configure(config: pytest.Config) -> None:
    global _mode
    config.addinivalue_line(
        "markers", f"{MARKER}(reason): allow this test to reach hosts outside the local machine"
    )
    _mode = _get_mode()
    if _mode != "off":
        install()
    config.stash[_merged_key] = []


def pytest_unconfigure(config: pytest.Config) -> None:
    uninstall()


@pytest.hookimpl(wrapper=True)
def pytest_collection(session: pytest.Session) -> Generator[None, object, object]:
    global _current_nodeid
    if _mode == "off":
        return (yield)
    _current_nodeid = "<collection>"
    try:
        return (yield)
    finally:
        _current_nodeid = None


@pytest.hookimpl(wrapper=True)
def pytest_runtest_protocol(
    item: pytest.Item, nextitem: pytest.Item | None
) -> Generator[None, object, object]:
    global _current_nodeid
    if _mode == "off" or item.get_closest_marker(MARKER) is not None:
        return (yield)
    _current_nodeid = item.nodeid
    try:
        return (yield)
    finally:
        _current_nodeid = None


@pytest.hookimpl(optionalhook=True)
def pytest_testnodedown(node: Any, error: object) -> None:
    workeroutput = getattr(node, "workeroutput", None) or {}
    records = workeroutput.get(_WORKEROUTPUT_KEY)
    if records:
        node.config.stash[_merged_key].extend(records)


def _report_path(config: pytest.Config) -> Path:
    if path := os.environ.get(REPORT_ENV):
        return Path(path)
    return config.rootpath / ".artifacts" / "network-guard.json"


def _merged(config: pytest.Config) -> list[dict[str, Any]]:
    return sorted(
        config.stash[_merged_key] + get_records(),
        key=lambda r: (r["target"], r["nodeid"], r["kind"]),
    )


@pytest.hookimpl(trylast=True)
def pytest_sessionfinish(session: pytest.Session) -> None:
    if _mode == "off":
        return
    config = session.config
    workeroutput = getattr(config, "workeroutput", None)
    if workeroutput is not None:
        workeroutput[_WORKEROUTPUT_KEY] = get_records()
        return
    path = _report_path(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    report = {"mode": _mode, "records": _merged(config)}
    path.write_bytes(orjson.dumps(report, option=orjson.OPT_INDENT_2))


def pytest_terminal_summary(terminalreporter: Any, config: pytest.Config) -> None:
    if _mode == "off" or hasattr(config, "workerinput"):
        return
    records = _merged(config)
    if not records:
        return
    terminalreporter.section("network guard")
    terminalreporter.write_line(
        f"{len(records)} blocked network attempt(s) ({_mode} mode), see {_report_path(config)}"
    )
    for record in records[:200]:
        origin = record["origin"][0] if record["origin"] else "?"
        terminalreporter.write_line(
            f"NETWORK-GUARD {record['kind']} {record['target']} x{record['count']} "
            f"[{record['thread']}] {record['nodeid']} @ {origin}"
        )
