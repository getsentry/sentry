from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import IO

from objectstore_client import Session, TimeToLive

from sentry import features, quotas
from sentry.constants import DataCategory
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.objectstore import UsecaseId, get_session


def writes_to_objectstore(project: Project) -> bool:
    return features.has("organizations:objectstore-preprod-exclusive-write", project.organization)


def retention_days(project: Project, category: DataCategory) -> int:
    return (
        quotas.backend.get_event_retention(organization=project.organization, category=category)
        or 90
    )


@dataclass(frozen=True)
class ObjectstoreFile:
    session: Session
    key: str
    size: int | None

    @classmethod
    def lookup(cls, usecase: UsecaseId, project: Project, key: str) -> ObjectstoreFile:
        session = get_session(usecase, project)
        metadata = session.head(key)
        if metadata is None:
            raise File.DoesNotExist
        # Objectstore reports the on-wire size. FileResponse serves decoded JSON.
        size = int(metadata.custom["uncompressed-size"]) if metadata.compression else metadata.size
        return cls(session, key, size)

    @classmethod
    def put(
        cls,
        usecase: UsecaseId,
        project: Project,
        stream: IO[bytes],
        size: int,
        *,
        filename: str,
        content_type: str,
        ttl_days: int,
    ) -> ObjectstoreFile:
        session = get_session(usecase, project)
        key = session.put(
            stream,
            filename=filename,
            content_type=content_type,
            metadata={"uncompressed-size": str(size)},
            expiration_policy=TimeToLive(timedelta(days=ttl_days)),
        )
        return cls(session, key, size)

    def delete(self) -> None:
        self.session.delete(self.key)

    def getfile(self) -> IO[bytes]:
        response = self.session.get(self.key)
        if response is None:
            raise File.DoesNotExist
        return response.payload
