from __future__ import annotations

import logging
from typing import IO, Literal

import urllib3
from objectstore_client import Compression, GetResponse, Metadata, RequestError, Session
from objectstore_client.multipart import MultipartUpload
from urllib3.exceptions import HTTPError

from sentry import options
from sentry.models.project import Project
from sentry.objectstore import UsecaseId, get_session
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def get_snapshot_usecase() -> UsecaseId:
    if options.get("preprod.snapshots.objectstore.snapshots-usecase.enabled"):
        return UsecaseId.PREPROD_SNAPSHOTS
    return UsecaseId.PREPROD


# TODO: On January 1, 2027, remove the preprod fallback and use preprod_snapshots exclusively.
class SnapshotStorage:
    def __init__(self, primary: Session, fallback: Session) -> None:
        self._primary = primary
        self._fallback = fallback

    def get(self, key: str) -> GetResponse | None:
        response = self._primary.get(key)
        if response is None:
            response = self._fallback.get(key)
            self._record_fallback("get", response is not None)
        return response

    def head(self, key: str) -> Metadata | None:
        metadata = self._primary.head(key)
        if metadata is None:
            metadata = self._fallback.head(key)
            self._record_fallback("head", metadata is not None)
        return metadata

    def _record_fallback(self, op: str, found: bool) -> None:
        metrics.incr(
            "preprod.snapshot_storage.legacy_fallback",
            tags={"op": op, "found": str(found).lower()},
        )
        logger.info(
            "preprod.objectstore.fallback",
            extra={
                "image_type": UsecaseId.PREPROD_SNAPSHOTS.value,
                "operation": op,
                "found": found,
            },
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
        error: RequestError | HTTPError | None = None
        for session in (self._primary, self._fallback):
            try:
                session.delete(key)
            except (RequestError, HTTPError) as caught_error:
                if error is None and (
                    not isinstance(caught_error, RequestError) or caught_error.status != 404
                ):
                    error = caught_error
        if error is not None:
            raise error


def get_snapshot_storage(
    project: Project | int,
    *,
    org: int | None = None,
    socket_timeout: urllib3.Timeout | None = None,
) -> SnapshotStorage:
    primary_usecase = get_snapshot_usecase()
    if primary_usecase == UsecaseId.PREPROD:
        fallback_usecase = UsecaseId.PREPROD_SNAPSHOTS
    else:
        fallback_usecase = UsecaseId.PREPROD

    return SnapshotStorage(
        primary=get_session(primary_usecase, project, org=org, socket_timeout=socket_timeout),
        fallback=get_session(fallback_usecase, project, org=org, socket_timeout=socket_timeout),
    )
