from collections.abc import MutableMapping
from typing import Any

from .base import DefaultEvent


class NelEvent(DefaultEvent):
    key = "nel"

    def extract_metadata(self, data: MutableMapping[str, Any]) -> dict[str, str]:
        metadata = super().extract_metadata(data)
        request = data.get("request")
        assert request is not None
        metadata["uri"] = request.get("url")
        return metadata
