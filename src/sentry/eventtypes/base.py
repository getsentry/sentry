from collections.abc import Mapping, MutableMapping
from typing import Any
from warnings import warn

from sentry.utils.safe import get_path
from sentry.utils.strings import strip, truncatechars

# Note: Detecting eventtypes is implemented in the Relay Rust library.


class BaseEvent:
    key: str  # abstract

    def get_metadata(self, data: MutableMapping[str, Any]) -> dict[str, str]:
        metadata = self.extract_metadata(data)
        title = data.get("title")
        if title is not None:
            # If we already have a custom title, it needs to be in metadata
            # regardless of what extract_metadata returns.
            metadata["title"] = title

        return metadata

    def get_title(self, metadata: Mapping[str, str | None]) -> str:
        title = metadata.get("title")
        if title is not None:
            return title
        return self.compute_title(metadata) or "<untitled>"

    def compute_title(self, metadata: Mapping[str, str | None]) -> str | None:
        return None

    def extract_metadata(self, metadata: MutableMapping[str, Any]) -> dict[str, str]:
        return {}

    def get_location(self, metadata: dict[str, str]) -> str | None:
        return None

    def to_string(self, metadata: dict[str, str | None]) -> str:
        warn(DeprecationWarning("This method was replaced by get_title"), stacklevel=2)
        return self.get_title(metadata)


class DefaultEvent(BaseEvent):
    key = "default"

    def extract_metadata(self, data: MutableMapping[str, Any]) -> dict[str, str]:
        message = strip(
            get_path(data, "logentry", "formatted") or get_path(data, "logentry", "message")
        )

        if message:
            title = truncatechars(message.splitlines()[0], 256)
        else:
            title = "<unlabeled event>"

        return {"title": title}
