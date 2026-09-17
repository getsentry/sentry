"""
Translates the SCM platform's synthetic Perforce routes into ``p4`` commands.
"""

from __future__ import annotations

import base64
import io
import tarfile
import time
from collections.abc import Iterator
from typing import Any

import requests

from sentry.integrations.perforce.client import PerforceClient
from sentry.integrations.perforce.p4protocol import P4Exception
from sentry.utils import json

# One ``p4 print`` returns every file it matches in a single round trip, but the
# protocol client buffers the whole result, so the manifest is printed in batches
# to keep peak memory proportional to a batch rather than to the depot.
PRINT_BATCH_SIZE = 200

# Perforce file types carry "+modifiers" (``binary+FS2w``); only the base type
# says whether the content is source. Filtering runs server-side where possible,
# but ``p4 print`` has no ``-F``, so the manifest is filtered again here.
TEXT_BASE_TYPES = frozenset({"text", "unicode", "utf8", "utf16"})

# Mirrors Seer's own per-file cap: larger files are unreadable to it anyway.
MAX_FILE_SIZE_BYTES = 1024 * 1024


class _ByteStream:
    """Adapts a byte iterator to the ``raw.stream()`` hook ``iter_content`` uses."""

    def __init__(self, chunks: Iterator[bytes]) -> None:
        self._chunks = chunks

    def stream(self, chunk_size: int, decode_content: bool = True) -> Iterator[bytes]:
        return self._chunks


def _response(
    content: bytes, status_code: int = 200, content_type: str = "application/json"
) -> requests.Response:
    response = requests.Response()
    response.status_code = status_code
    response._content = content
    response.headers["Content-Type"] = content_type
    return response


def _json_response(payload: Any, status_code: int = 200) -> requests.Response:
    return _response(json.dumps(payload).encode(), status_code)


def _streamed_response(chunks: Iterator[bytes]) -> requests.Response:
    response = requests.Response()
    response.status_code = 200
    response.headers["Content-Type"] = "application/gzip"
    response.raw = _ByteStream(chunks)
    return response


def base_type(head_type: str) -> str:
    return head_type.split("+", 1)[0].lower()


def segment_print(result: list[Any]) -> list[tuple[dict[str, str], bytes]]:
    """
    Split a ``p4 print`` result into (stat, content) pairs.
    """
    files: list[tuple[dict[str, str], list[bytes]]] = []
    for item in result:
        if isinstance(item, dict):
            files.append((item, []))
        elif files:
            files[-1][1].append(item if isinstance(item, bytes) else str(item).encode())
    return [(stat, b"".join(parts)) for stat, parts in files]


def _p4_date(value: str | None) -> str | None:
    """Perforce dates are ``YYYY/MM/DD``; the provider sends ISO."""
    return value.replace("-", "/") if value else None


class PerforceApiClient:
    def __init__(self, client: PerforceClient) -> None:
        self.client = client

    def request(
        self,
        method: str,
        path: str,
        headers: dict[str, str] | None = None,
        data: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
        allow_redirects: bool | None = None,
        stream: bool = True,
        raw_response: bool = True,
        credentials_set: str = "installation",
        timeout: float | tuple[float, float] | None = None,
    ) -> requests.Response:
        handler = {
            "/files": self.handle_files,
            "/fstat": self.handle_fstat,
            "/changes": self.handle_changes,
            "/describe": self.handle_describe,
            "/print": self.handle_print,
            "/archive": self.handle_archive,
        }.get(path)
        if handler is None:
            return _json_response({"error": f"unknown perforce route: {path}"}, status_code=404)

        try:
            return handler(params or {})
        except P4Exception as e:
            message = str(e)
            status = 404 if "no such file" in message.lower() else 500
            return _response(message.encode(), status_code=status, content_type="text/plain")

    def handle_files(self, params: dict[str, str]) -> requests.Response:
        args = ["-m", params["max"]] if params.get("max") else []
        with self.client._connect() as p4:
            records = p4.run("files", *args, params["path"])
        return _json_response([r for r in records if isinstance(r, dict)])

    def handle_fstat(self, params: dict[str, str]) -> requests.Response:
        return _json_response(
            self.fstat(params["path"], params.get("filter"), params.get("fields"))
        )

    def fstat(self, path: str, filter_expr: str | None, fields: str | None) -> list[dict[str, str]]:
        args = ["-Ol"]
        if filter_expr:
            args += ["-F", filter_expr]
        if fields:
            args += ["-T", fields]
        with self.client._connect() as p4:
            records = p4.run("fstat", *args, path)
        return [r for r in records if isinstance(r, dict)]

    def handle_changes(self, params: dict[str, str]) -> requests.Response:
        path = params["path"]
        since, until = _p4_date(params.get("since")), _p4_date(params.get("until"))
        if since or until:
            path = f"{path}@{since or '0'},@{until or 'now'}"
        args = ["-l"] + (["-m", params["max"]] if params.get("max") else [])
        with self.client._connect() as p4:
            records = [r for r in p4.run("changes", *args, path) if isinstance(r, dict)]
        return _json_response(self.enrich_users(records))

    def handle_describe(self, params: dict[str, str]) -> requests.Response:
        with self.client._connect() as p4:
            records = [r for r in p4.run("describe", "-s", params["change"]) if isinstance(r, dict)]
        return _json_response(self.enrich_users(records))

    def enrich_users(self, records: list[dict[str, str]]) -> list[dict[str, str]]:
        """Attach real names and emails to change records.

        ``p4 changes`` reports only a login, but ``CommitAuthor.email`` is
        required downstream. Looked up once per distinct user rather than per
        record, since a listing is usually dominated by a handful of authors.
        """
        cache: dict[str, Any] = {}
        for record in records:
            login = record.get("user")
            if not login:
                continue
            email, name = self.client.get_author_info_from_cache(login, cache)
            if email:
                record["userEmail"] = email
            if name:
                record["userFullName"] = name
        return records

    def handle_print(self, params: dict[str, str]) -> requests.Response:
        with self.client._connect() as p4:
            result = p4.run("print", params["path"])
        files = segment_print(result)
        if not files:
            return _response(b"no such file(s).", status_code=404, content_type="text/plain")

        stat, content = files[0]
        return _json_response({"stat": stat, "content_base64": base64.b64encode(content).decode()})

    def handle_archive(self, params: dict[str, str]) -> requests.Response:
        path, change = params["path"], params.get("change")
        scoped = f"{path}@{change}" if change else path
        manifest = self.fstat(
            scoped, params.get("filter"), "depotFile,headType,headAction,fileSize"
        )

        depot_root = path.removesuffix("/...")
        readable = [
            record["depotFile"]
            for record in manifest
            if record.get("headAction") != "delete"
            and base_type(record.get("headType", "")) in TEXT_BASE_TYPES
            and int(record.get("fileSize") or 0) <= MAX_FILE_SIZE_BYTES
        ]
        prefix = f"{depot_root.strip('/').replace('/', '-')}-{change or 'head'}"
        return _streamed_response(self.tar_stream(prefix, depot_root, readable, change))

    def tar_stream(
        self, prefix: str, depot_root: str, paths: list[str], change: str | None
    ) -> Iterator[bytes]:
        """Yield a gzipped tar of ``paths``, printed in batches.

        Every member sits under a single top-level directory: Seer's extractor
        moves that directory's *contents* into place, so a tar with entries at the
        root silently yields a wrong tree rather than an error.
        """
        buffer = io.BytesIO()
        tar = tarfile.open(fileobj=buffer, mode="w|gz")
        mtime = int(time.time())

        def drain() -> bytes:
            chunk = buffer.getvalue()
            buffer.seek(0)
            buffer.truncate()
            return chunk

        try:
            for start in range(0, len(paths), PRINT_BATCH_SIZE):
                batch = [
                    f"{p}@{change}" if change else p
                    for p in paths[start : start + PRINT_BATCH_SIZE]
                ]
                with self.client._connect() as p4:
                    result = p4.run("print", *batch)

                for stat, content in segment_print(result):
                    name = stat.get("depotFile", "").removeprefix(f"{depot_root}/")
                    if not name:
                        continue
                    info = tarfile.TarInfo(f"{prefix}/{name}")
                    info.size = len(content)
                    info.mtime = mtime
                    tar.addfile(info, io.BytesIO(content))
                    if chunk := drain():
                        yield chunk
        finally:
            tar.close()
        if chunk := drain():
            yield chunk
