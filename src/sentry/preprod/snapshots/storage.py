from __future__ import annotations

from typing import IO, Literal

from objectstore_client import Compression, GetResponse, Metadata, RequestError, Session
from objectstore_client.multipart import MultipartUpload

from sentry.models.project import Project
from sentry.objectstore import UsecaseId, get_session


class SnapshotStorage:
    """Writes go to the snapshots usecase; reads fall back to the legacy preprod
    usecase for objects uploaded by CLIs that predate the usecase split."""

    def __init__(self, primary: Session, legacy: Session) -> None:
        self._primary = primary
        self._legacy = legacy

    def get(self, key: str) -> GetResponse | None:
        response = self._primary.get(key)
        if response is None:
            response = self._legacy.get(key)
        return response

    def head(self, key: str) -> Metadata | None:
        metadata = self._primary.head(key)
        if metadata is None:
            metadata = self._legacy.head(key)
        return metadata

    def put(self, contents: bytes | IO[bytes], *, key: str, content_type: str | None = None) -> str:
        return self._primary.put(contents, key=key, content_type=content_type)

    def initiate_multipart_upload(
        self, *, key: str, compression: Compression | Literal["none"], content_type: str
    ) -> MultipartUpload:
        return self._primary.initiate_multipart_upload(
            key=key, compression=compression, content_type=content_type
        )

    def delete(self, key: str) -> None:
        for session in (self._primary, self._legacy):
            try:
                session.delete(key)
            except RequestError as e:
                if e.status != 404:
                    raise


def get_snapshot_storage(project: Project | int, *, org: int | None = None) -> SnapshotStorage:
    return SnapshotStorage(
        get_session(UsecaseId.SNAPSHOTS, project, org=org),
        get_session(UsecaseId.PREPROD, project, org=org),
    )
