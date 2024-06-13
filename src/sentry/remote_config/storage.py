from io import BytesIO
from typing import TypedDict

from sentry import options
from sentry.cache import default_cache
from sentry.models.files.utils import get_storage
from sentry.models.project import Project
from sentry.utils import json, metrics

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


class ConfigurationCache:
    def __init__(self, key: str) -> None:
        self.key = key

    def get(self) -> StorageFormat | None:
        cache_result = default_cache.get(self.key)

        if cache_result is None:
            metrics.incr("remote_config.configuration.cache_miss")
        else:
            metrics.incr("remote_config.configuration.cache_hit")

        return cache_result

    def set(self, value: StorageFormat) -> None:
        default_cache.set(self.key, value=value, timeout=None)

    def pop(self) -> None:
        try:
            default_cache.delete(self.key)
        except Exception:
            pass


class ConfigurationStorage:
    def __init__(self, key: str) -> None:
        self.key = key

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


class ConfigurationBackend:
    def __init__(self, project: Project) -> None:
        self.project = project
        self.key = f"configurations/{self.project.id}/production"

        self.cache = ConfigurationCache(self.key)
        self.storage = ConfigurationStorage(self.key)

    def get(self) -> tuple[StorageFormat | None, str]:
        cache_result = self.cache.get()
        if cache_result is not None:
            return (cache_result, "cache")

        storage_result = self.storage.get()
        if storage_result:
            self.cache.set(storage_result)

        return (storage_result, "store")

    def set(self, value: StorageFormat) -> None:
        self.storage.set(value)
        self.cache.set(value)

    def pop(self) -> None:
        self.cache.pop()
        self.storage.pop()


class APIBackendDecorator:
    def __init__(self, backend: ConfigurationBackend) -> None:
        self.driver = backend

    def get(self) -> tuple[APIFormat | None, str]:
        result, source = self.driver.get()
        return self._deserialize(result), source

    def set(self, value: APIFormat) -> None:
        self.driver.set(self._serialize(value))

    def pop(self) -> None:
        self.driver.pop()

    def _deserialize(self, result: StorageFormat | None) -> APIFormat | None:
        if result is None:
            return None

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


def make_configuration_backend(project: Project):
    return ConfigurationBackend(project)


def make_api_backend(project: Project):
    return APIBackendDecorator(make_configuration_backend(project))
