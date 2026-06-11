"""Pure-Python Perforce (Helix) RPC client.

A drop-in replacement for the subset of the P4Python ``P4`` API used by this
integration, implemented directly against the Perforce wire protocol so the
integration carries no compiled C dependency and never performs server-driven
local filesystem I/O.

Cross-checked against the open-source perforce/p4java reference implementation
(``Mangle.java`` for the login cipher and ``ClientUserInteraction.java`` for
the ``client-Crypto`` and login digests).

Credit / license: the login "Mangle" cipher below (the ``_otox``, ``_getdval``,
``_mangle_block`` and ``_mangle_encrypt`` functions and the ``_O``/``_PR``/
``_S0``/``_S1`` S-box constants) is a Python port of ``Mangle.java`` from the
Perforce P4Java client (https://github.com/perforce/p4java), Copyright (c)
Perforce Software, Inc., used under the BSD-3-Clause terms in the LICENSE file
alongside this module.
"""

from __future__ import annotations

import hashlib
import os
import re
import socket
import ssl
import struct
from typing import Any

_O = [7, 6, 2, 1, 5, 0, 3, 4]
_PR = [2, 5, 4, 0, 3, 1, 7, 6]
_S0 = [12, 15, 7, 10, 14, 13, 11, 0, 2, 6, 3, 1, 9, 4, 5, 8]
_S1 = [7, 2, 14, 9, 3, 11, 0, 4, 12, 13, 1, 10, 6, 15, 8, 5]
_BPB = 8

_DEFAULT_TIMEOUT = 30


def _otox(octets: list[int]) -> str:
    out = []
    for b in octets:
        b &= 0xFF
        for nib in ((b >> 4) & 0xF, b & 0xF):
            out.append(chr(nib - 10 + 65 if nib >= 10 else nib + 48))
    return "".join(out)


def _getdval(m: list[int], k: list[int]) -> None:
    h0, h1 = 0, 1
    tcb = 0
    tr = [0] * _BPB
    for _ in range(16):
        tcbindex = tcb
        for byte in range(8):
            lo = (
                m[h1 * 64 + _BPB * byte + 7] * 8
                + m[h1 * 64 + _BPB * byte + 6] * 4
                + m[h1 * 64 + _BPB * byte + 5] * 2
                + m[h1 * 64 + _BPB * byte + 4]
            )
            hi = (
                m[h1 * 64 + _BPB * byte + 3] * 8
                + m[h1 * 64 + _BPB * byte + 2] * 4
                + m[h1 * 64 + _BPB * byte + 1] * 2
                + m[h1 * 64 + _BPB * byte + 0]
            )
            v = (_S0[lo] + 16 * _S1[hi]) * (1 - k[_BPB * tcbindex + byte]) + (
                _S0[hi] + 16 * _S1[lo]
            ) * k[_BPB * tcbindex + byte]
            for t in range(_BPB):
                tr[t] = v & 1
                v >>= 1
            for bit in range(_BPB):
                index = (_O[bit] + byte) & 0x7
                temp1 = m[h0 * 64 + _BPB * index + bit] + k[_BPB * tcb + _PR[bit]] + tr[_PR[bit]]
                m[h0 * 64 + _BPB * index + bit] = temp1 & 1
            if byte < 7:
                tcb = (tcb + 1) & 0xF
        h0, h1 = h1, h0
    for byte in range(8):
        for bit in range(_BPB):
            t = m[_BPB * byte + bit]
            m[_BPB * byte + bit] = m[64 + _BPB * byte + bit]
            m[64 + _BPB * byte + bit] = t


def _mangle_block(data: str, key: str) -> str:
    m = [0] * 128
    k = [0] * 128
    src = [0] * 16
    buf = [0] * 16
    q = [0] * 16
    for i, ch in enumerate(key[:16]):
        buf[i] = ord(ch) & 0xFF
    for i, ch in enumerate(data[:16]):
        src[i] = ord(ch) & 0xFF
    for counter in range(16):
        c = buf[counter] & 0xFF
        for i in range(_BPB):
            k[_BPB * counter + i] = c & 1
            c >>= 1
    counter = 0
    qi = 0
    for j in range(16):
        c = src[j]
        if counter == 16:
            _getdval(m, k)
            for counter in range(16):
                output = 0
                for i in range(_BPB - 1, -1, -1):
                    output = (output << 1) + m[_BPB * counter + i]
                q[qi] = output
                qi += 1
            counter = 0
        for i in range(_BPB):
            m[_BPB * counter + i] = c & 1
            c >>= 1
        counter += 1
    while counter < 16:
        for i in range(_BPB):
            m[_BPB * counter + i] = 0
        counter += 1
    _getdval(m, k)
    for counter in range(16):
        output = 0
        for i in range(_BPB - 1, -1, -1):
            output = (output << 1) + m[_BPB * counter + i]
        q[qi] = output
        qi += 1
    return _otox(q)


def _mangle_encrypt(data: str, key: str) -> str:
    chars = "".join(chr(b) for b in data.encode("utf-8"))
    out = []
    off = 0
    while off < len(chars):
        cs = min(16, len(chars) - off)
        out.append(_mangle_block(chars[off : off + cs], key))
        off += cs
    return "".join(out)


def _md5_hex_upper(*parts: bytes) -> str:
    h = hashlib.md5()
    for p in parts:
        h.update(p)
    return h.hexdigest().upper()


def _der_tlv(data: bytes, off: int) -> tuple[int, int, int]:
    tag = data[off]
    p = off + 1
    ln = data[p]
    p += 1
    if ln & 0x80:
        nb = ln & 0x7F
        ln = int.from_bytes(data[p : p + nb], "big")
        p += nb
    return tag, p, ln


def _extract_spki(cert_der: bytes) -> bytes:
    _, cert_vs, _ = _der_tlv(cert_der, 0)
    _, tbs_vs, _ = _der_tlv(cert_der, cert_vs)
    p = tbs_vs
    if cert_der[p] == 0xA0:
        _, vvs, vvl = _der_tlv(cert_der, p)
        p = vvs + vvl
    for _ in range(5):
        _, vs, vl = _der_tlv(cert_der, p)
        p = vs + vl
    _, vs, vl = _der_tlv(cert_der, p)
    return cert_der[p : vs + vl]


def _encode_message(fields: list[tuple[bytes, bytes]]) -> bytes:
    payload = b"".join(
        name + b"\0" + struct.pack("<I", len(val)) + val + b"\0" for name, val in fields
    )
    lb = struct.pack("<I", len(payload))
    return bytes([lb[0] ^ lb[1] ^ lb[2] ^ lb[3]]) + lb + payload


class P4Exception(Exception):
    pass


_REFUSED_RPCS = frozenset(
    {
        b"client-OpenFile",
        b"client-WriteFile",
        b"client-CloseFile",
        b"client-OpenMatch",
        b"client-WriteMatch",
        b"client-CloseMatch",
        b"client-DeleteFile",
        b"client-ChmodFile",
        b"client-SendFile",
        b"client-EditData",
        b"client-MoveFile",
        b"client-ReceiveFiles",
        b"client-ActionResolve",
    }
)

_META_STAT_FIELDS = frozenset({b"func", b"__args__", b"specdef", b"specFormatted"})


class P4:
    def __init__(self) -> None:
        self.port = "localhost:1666"
        self.user = ""
        self.password: str | None = None
        self.client: str | None = os.environ.get("P4CLIENT") or socket.gethostname().split(".")[0]
        self.charset: str | None = None
        self.cwd: str | None = None
        self.ticket_file: str | None = None
        self.exception_level = 1
        self.use_ssl = False
        self._sock: socket.socket | None = None
        self._buf = b""
        self._daddr = "0"
        self._server_level = 0
        self._ticket: str | None = None

    def env(self, name: str) -> str:
        config_name = os.environ.get("P4CONFIG", ".p4config")
        directory = self.cwd or os.getcwd()
        while True:
            path = os.path.join(directory, config_name)
            if os.path.isfile(path):
                try:
                    with open(path) as fh:
                        for line in fh:
                            stripped = line.strip()
                            if stripped.startswith(name + "="):
                                return stripped.split("=", 1)[1]
                except OSError:
                    pass
            parent = os.path.dirname(directory)
            if parent == directory:
                return os.environ.get(name, "")
            directory = parent

    def connect(self) -> None:
        host, port = self._host_port()
        try:
            raw = socket.create_connection((host, port), timeout=_DEFAULT_TIMEOUT)
        except OSError as exc:
            raise P4Exception(
                f"connect to server failed; check P4PORT. TCP connect to {host}:{port} failed: {exc}"
            )
        peer = raw.getpeername()
        self._daddr = f"{peer[0]}:{peer[1]}"
        if self.port.startswith("ssl"):
            self.use_ssl = True
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            try:
                self._sock = context.wrap_socket(raw, server_hostname=host)
            except ssl.SSLError as exc:
                raw.close()
                raise P4Exception(f"SSL connection to {host}:{port} failed: {exc}")
        else:
            self._sock = raw
        self._send_protocol()

    def _host_port(self) -> tuple[str, int]:
        parts = self.port.split(":")
        if len(parts) == 3:
            return parts[1], int(parts[2])
        return parts[0], int(parts[1])

    def connected(self) -> bool:
        return self._sock is not None

    def disconnect(self) -> None:
        if self._sock is not None:
            try:
                self._write(_encode_message([(b"func", b"release2")]))
            except OSError:
                pass
            try:
                self._sock.close()
            finally:
                self._sock = None

    def run_trust(self, *args: str) -> None:
        if not self.use_ssl:
            return
        fingerprint = None
        argv = iter(args)
        for arg in argv:
            if arg == "-i":
                fingerprint = next(argv, None)
            elif not arg.startswith("-"):
                fingerprint = arg
        if not fingerprint:
            return
        assert isinstance(self._sock, ssl.SSLSocket)
        cert_der = self._sock.getpeercert(binary_form=True)
        if cert_der is None:
            raise P4Exception("SSL trust failed: server presented no certificate")
        spki = _extract_spki(cert_der)
        candidates = {
            hashlib.sha1(spki).hexdigest().upper(),
            hashlib.sha256(spki).hexdigest().upper(),
        }
        if fingerprint.replace(":", "").upper() not in candidates:
            raise P4Exception(
                "The fingerprint for the server does not match the trusted fingerprint: "
                f"{fingerprint}"
            )

    def _send_protocol(self) -> None:
        fields = [
            (b"client", b"98"),
            (b"api", b"99999"),
            (b"enableStreams", b""),
            (b"enableGraph", b""),
            (b"expandAndmaps", b""),
            (b"host", socket.gethostname().encode()),
            (b"port", self.port.encode()),
            (b"autoTune", b"1"),
            (b"func", b"protocol"),
        ]
        self._write(_encode_message(fields))

    def _write(self, data: bytes) -> None:
        assert self._sock is not None
        self._sock.sendall(data)

    def _read_message(self) -> dict[bytes, bytes]:
        while len(self._buf) < 5:
            self._fill()
        length = struct.unpack("<I", self._buf[1:5])[0]
        while len(self._buf) < 5 + length:
            self._fill()
        payload = self._buf[5 : 5 + length]
        self._buf = self._buf[5 + length :]
        return self._parse_fields(payload)

    def _fill(self) -> None:
        assert self._sock is not None
        chunk = self._sock.recv(65536)
        if not chunk:
            raise P4Exception("Perforce server closed the connection")
        self._buf += chunk

    @staticmethod
    def _parse_fields(payload: bytes) -> dict[bytes, bytes]:
        out: dict[bytes, bytes] = {}
        i = 0
        n = len(payload)
        while i < n:
            j = payload.index(0, i)
            name = payload[i:j]
            i = j + 1
            vlen = struct.unpack("<I", payload[i : i + 4])[0]
            i += 4
            out[name] = payload[i : i + vlen]
            i += vlen + 1
        return out

    def run(self, *cmd_args: str) -> list[Any]:
        if self._sock is None:
            raise P4Exception("not connected")
        fields: list[tuple[bytes, bytes]] = [
            (b"tag", b""),
            (b"prog", b"sentry-perforce"),
            (b"user", self.user.encode()),
            (b"host", socket.gethostname().encode()),
            (b"os", b"UNIX"),
            (b"cwd", b"/"),
        ]
        if self.client:
            fields.append((b"client", self.client.encode()))
        fields.append((b"clientCase", b"1"))
        if self.charset and self.charset != "none":
            fields.append((b"unicode", b""))
            fields.append((b"charset", b"1"))
            fields.append((b"utf8bom", b"0"))
        fields += [(b"", arg.encode()) for arg in cmd_args[1:]]
        fields.append((b"func", ("user-" + cmd_args[0]).encode()))
        self._write(_encode_message(fields))
        return self._dispatch()

    def run_login(self) -> list[Any]:
        return self.run("login")

    def _dispatch(self) -> list[Any]:
        results: list[Any] = []
        errors: list[str] = []
        while True:
            msg = self._read_message()
            func = msg.get(b"func", b"")
            if func == b"protocol":
                self._server_level = int(msg.get(b"server2", b"0") or b"0")
            elif func == b"client-Crypto":
                self._handle_crypto(msg)
            elif func == b"client-Prompt":
                self._handle_prompt(msg)
            elif func == b"client-SetPassword":
                data = msg.get(b"data")
                if data:
                    self._ticket = data.decode()
            elif func == b"flush1":
                echo = [(b"func", b"flush2")]
                echo += [(key, msg[key]) for key in (b"himark", b"fseq", b"rseq") if key in msg]
                self._write(_encode_message(echo))
            elif func == b"client-Message":
                self._handle_message(msg, errors)
            elif func in (b"client-FstatInfo", b"client-FstatPartial", b"client-OutputInfo"):
                results.append(self._decode_stat(msg))
            elif func in (b"client-OutputText", b"client-OutputData"):
                results.append(msg.get(b"data", b""))
            elif func == b"client-OutputError":
                errors.append(msg.get(b"data", b"").decode("utf-8", "replace"))
            elif func in (b"client-Ack", b"client-Stats", b"client-HandleError"):
                pass
            elif func in (b"release", b"release2"):
                break
            elif func in _REFUSED_RPCS:
                raise P4Exception(
                    f"refused server-initiated file I/O RPC {func.decode()!r}: "
                    "this client never reads from or writes to the local filesystem"
                )
            else:
                raise P4Exception(f"unsupported server RPC {func.decode()!r}")
        if errors:
            raise P4Exception("; ".join(errors))
        return results

    def _secret(self) -> str:
        return self._ticket or self.password or ""

    def _handle_crypto(self, msg: dict[bytes, bytes]) -> None:
        token = msg.get(b"token", b"")
        confirm = msg.get(b"confirm", b"crypto")
        resp = _md5_hex_upper(token, self._secret().encode())
        out: list[tuple[bytes, bytes]] = []
        if self._server_level >= 29 and self._daddr and self._daddr != "0":
            resp = _md5_hex_upper(resp.encode(), self._daddr.encode())
            out.append((b"daddr", self._daddr.encode()))
        out.append((b"token", resp.encode()))
        out.append((b"func", confirm))
        self._write(_encode_message(out))

    def _handle_prompt(self, msg: dict[bytes, bytes]) -> None:
        confirm = msg.get(b"confirm", b"")
        password = self.password or ""
        if b"digest" in msg:
            resp = hashlib.md5(password.encode("utf-8")).hexdigest().upper()
            digest = msg[b"digest"]
            if digest:
                resp = _md5_hex_upper(resp.encode(), digest)
        elif b"mangle" in msg:
            key = _md5_hex_upper(msg[b"mangle"], self.user.encode())
            resp = _mangle_encrypt(password, key)
        else:
            resp = hashlib.md5(password.encode("utf-8")).hexdigest().upper()
        out = [(key, val) for key, val in msg.items() if key != b"func"]
        out.append((b"data", resp.encode()))
        out.append((b"func", confirm))
        self._write(_encode_message(out))

    def _handle_message(self, msg: dict[bytes, bytes], errors: list[str]) -> None:
        idx = 0
        while ("code%d" % idx).encode() in msg:
            code = int(msg[("code%d" % idx).encode()])
            severity = (code >> 28) & 0xF
            threshold = 2 if self.exception_level >= 2 else 3
            if severity >= threshold:
                fmt = msg.get(("fmt%d" % idx).encode(), b"").decode("utf-8", "replace")
                errors.append(self._format(fmt, msg))
            idx += 1

    @staticmethod
    def _format(fmt: str, msg: dict[bytes, bytes]) -> str:
        def repl(match: re.Match[str]) -> str:
            if match.group("lit") is not None:
                return match.group("lit")
            val = msg.get(match.group("var").encode())
            return val.decode("utf-8", "replace") if val is not None else ""

        return re.sub(r"%'(?P<lit>[^']*)'%|%(?P<var>\w+)%", repl, fmt)

    @staticmethod
    def _decode_stat(msg: dict[bytes, bytes]) -> dict[str, str]:
        out: dict[str, str] = {}
        for key, val in msg.items():
            if key in _META_STAT_FIELDS:
                continue
            name = key.decode()
            if name.startswith("extraTag"):
                continue
            out[name] = val.decode("utf-8", "replace")
        return out
