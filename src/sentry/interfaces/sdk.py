__all__ = ("Sdk",)

from collections.abc import Mapping
from typing import Annotated, Any, Self, TypedDict

from sentry.apidocs.descriptions import ApiDescription
from sentry.interfaces.base import Interface
from sentry.utils.json import prune_empty_keys


class EventSdkApiContext(TypedDict):
    name: Annotated[
        str | None, ApiDescription("Name of the SDK that sent the event, such as sentry.python")
    ]
    version: Annotated[str | None, ApiDescription("Version of the SDK")]


class Sdk(Interface):
    """
    The SDK used to transmit this event.

    >>> {
    >>>     "name": "sentry.java",
    >>>     "version": "1.7.10",
    >>>     "integrations": ["log4j"],
    >>>     "packages": [
    >>>         {
    >>>             "name": "maven:io.sentry.sentry",
    >>>             "version": "1.7.10",
    >>>         }
    >>>     ]
    >>> }
    """

    @classmethod
    def to_python(cls, data: dict[str, Any]) -> Self | None:
        for key in ("name", "version", "integrations", "packages"):
            data.setdefault(key, None)

        return super().to_python(data)

    def to_json(self) -> dict[str, Any]:
        return prune_empty_keys(
            {
                "name": self.name,
                "version": self.version,
                "integrations": self.integrations or None,
                "packages": self.packages or None,
            }
        )

    def get_api_context(
        self, is_public: bool = False, platform: str | None = None
    ) -> EventSdkApiContext:
        return {"name": self.name, "version": self.version}

    def get_api_meta(
        self,
        meta: Mapping[str, Any],
        is_public: bool = False,
        platform: str | None = None,
    ) -> Mapping[str, Any] | None:
        return {"": meta.get(""), "name": meta.get("name"), "version": meta.get("version")}
