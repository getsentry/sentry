from __future__ import annotations

from dataclasses import dataclass
from typing import IO

from objectstore_client import Session

from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.objectstore import UsecaseId, get_session


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

    def getfile(self) -> IO[bytes]:
        response = self.session.get(self.key)
        if response is None:
            raise File.DoesNotExist
        return response.payload
