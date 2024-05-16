from io import BytesIO
from typing import TypedDict

from sentry import options
from sentry.models.files.utils import get_storage
from sentry.models.project import Project
from sentry.utils import json

JSONValue = str | int | float | bool | None | list["JSONValue"] | dict[str, "JSONValue"]


class Options(TypedDict):
    sample_rate: float
    traces_sample_rate: float
    user_config: JSONValue


class StorageFormat(TypedDict):
    options: Options
    version: int


class APIFormat(TypedDict):
    id: int
    sample_rate: float
    traces_sample_rate: float
    user_config: JSONValue


class StorageBackend:
    def __init__(self, project: Project) -> None:
        self.driver = BlobDriver(project)
        self.project = project

    def get(self) -> APIFormat | None:
        result = self.driver.get()
        if result is not None:
            return self._deserialize(result)

    def set(self, value: APIFormat) -> None:
        self.driver.set(self._serialize(value))

    def pop(self) -> None:
        self.driver.pop()

    def _deserialize(self, result: StorageFormat) -> APIFormat:
        return {
            "id": self.project.id,
            "sample_rate": result["options"]["sample_rate"],
            "traces_sample_rate": result["options"]["traces_sample_rate"],
            "user_config": result["options"]["user_config"],
        }

    def _serialize(self, result: APIFormat) -> StorageFormat:
        return {
            "options": {
                "sample_rate": result["sample_rate"],
                "traces_sample_rate": result["traces_sample_rate"],
                "user_config": result["user_config"],
            },
            "version": 1,
        }


class BlobDriver:
    def __init__(self, project: Project) -> None:
        self.project = project

    @property
    def key(self):
        return f"configurations/{self.project.id}/production"

    @property
    def storage(self):
        return get_storage(self._make_storage_options())

    def get(self) -> StorageFormat | None:
        try:
            blob = self.storage.open(self.key)
            result = blob.read()
            blob.close()
        except Exception:
            return None

        if result is not None:
            return json.loads(result)

    def set(self, value: StorageFormat) -> None:
        self.storage.save(self.key, BytesIO(json.dumps(value).encode()))

    def pop(self) -> None:
        try:
            self.storage.delete(self.key)
        except Exception:
            return None

    def _make_storage_options(self) -> dict | None:
        backend = options.get("configurations.storage.backend")
        if backend:
            return {
                "backend": backend,
                "options": options.get("configurations.storage.options"),
            }
        else:
            return None


class ProjectOptionsDriver:
    def __init__(self, project: Project) -> None:
        self.project = project

    def get(self) -> StorageFormat | None:
        return self.project.get_option("sentry:remote_config")

    def set(self, value: StorageFormat) -> None:
        self.project.update_option("sentry:remote_config", value)

    def pop(self) -> None:
        self.project.delete_option("sentry:remote_config")


def make_storage(project):
    return StorageBackend(project)
