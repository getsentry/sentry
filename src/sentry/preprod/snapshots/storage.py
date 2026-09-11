from __future__ import annotations

from collections.abc import Sequence
from typing import IO, Literal

from objectstore_client import Compression, GetResponse, Metadata, RequestError, Session
from objectstore_client.multipart import MultipartUpload

from sentry.models.project import Project
from sentry.objectstore import UsecaseId, get_session
from sentry.utils import metrics

SNAPSHOT_USECASES = (UsecaseId.PREPROD, UsecaseId.SNAPSHOTS)


class SnapshotStorage:
    def __init__(self, primary: Session, legacy: Sequence[Session]) -> None:
        self._primary = primary
        self._legacy = legacy

    def get(self, key: str) -> GetResponse | None:
        response = self._primary.get(key)
        if response is None:
            for session in self._legacy:
                response = session.get(key)
                if response is not None:
                    break
            self._record_fallback("get", response is not None)
        return response

    def head(self, key: str) -> Metadata | None:
        metadata = self._primary.head(key)
        if metadata is None:
            for session in self._legacy:
                metadata = session.head(key)
                if metadata is not None:
                    break
            self._record_fallback("head", metadata is not None)
        return metadata

    def _record_fallback(self, op: str, found: bool) -> None:
        metrics.incr(
            "preprod.snapshot_storage.legacy_fallback",
            tags={"op": op, "found": str(found).lower()},
        )

    def put(self, contents: bytes | IO[bytes], *, key: str, content_type: str | None = None) -> str:
        return self._primary.put(contents, key=key, content_type=content_type)

    def initiate_multipart_upload(
        self, *, key: str, compression: Compression | Literal["none"], content_type: str
    ) -> MultipartUpload:
        return self._primary.initiate_multipart_upload(
            key=key, compression=compression, content_type=content_type
        )

    def delete(self, key: str) -> None:
        error: RequestError | None = None
        for session in (self._primary, *self._legacy):
            try:
                session.delete(key)
            except RequestError as e:
                if e.status != 404:
                    error = e
        if error is not None:
            raise error


def get_snapshot_storage(project: Project | int, *, org: int | None = None) -> SnapshotStorage:
    primary, *legacy = SNAPSHOT_USECASES
    return SnapshotStorage(
        get_session(primary, project, org=org),
        [get_session(u, project, org=org) for u in legacy],
    )
