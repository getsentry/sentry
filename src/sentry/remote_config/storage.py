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


class Feature(TypedDict):
    key: str
    value: JSONValue


class StorageFormat(TypedDict):
    features: list[Feature]
    options: Options
    version: int


class APIFormat(TypedDict):
    features: list[Feature]
    options: Options


class StorageBackend:
    def __init__(self, key: Project) -> None:
        self.driver = BlobDriver(key)
        self.key = key

    def get(self) -> APIFormat | None:
        result = self.driver.get()
        if result is None:
            return None
        return self._deserialize(result)

    def set(self, value: APIFormat) -> None:
        self.driver.set(self._serialize(value))

    def pop(self) -> None:
        self.driver.pop()

    def _deserialize(self, result: StorageFormat) -> APIFormat:
        return {
            "features": result["features"],
            "options": result["options"],
        }

    def _serialize(self, result: APIFormat) -> StorageFormat:
        return {
            "features": result["features"],
            "options": result["options"],
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
        return get_storage(self._make_storage_config())

    def get(self) -> StorageFormat | None:
        try:
            blob = self.storage.open(self.key)
            result = blob.read()
            blob.close()
        except Exception:
            return None

        if result is None:
            return None
        return json.loads(result)

    def set(self, value: StorageFormat) -> None:
        self.storage.save(self.key, BytesIO(json.dumps(value).encode()))

    def pop(self) -> None:
        try:
            self.storage.delete(self.key)
        except Exception:
            return None

    def _make_storage_config(self) -> dict | None:
        backend = options.get("configurations.storage.backend")
        if backend:
            return {
                "backend": backend,
                "options": options.get("configurations.storage.options"),
            }
        else:
            return None


def make_storage(key: Project):
    return StorageBackend(key)
