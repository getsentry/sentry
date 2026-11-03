from collections.abc import Mapping
from typing import Any

from sentry.utils.services import Service


class ProjectConfigCache(Service):
    __all__ = ("set_many", "get")

    def __init__(self, **options: object) -> None:
        pass

    def set_many(self, configs: Mapping[str, Mapping[str, object] | None]) -> None:
        pass

    def get(self, public_key: str) -> Any:
        raise NotImplementedError()
