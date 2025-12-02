from collections.abc import MutableMapping
from typing import Any

from sentry.utils.safe import get_path

from .base import BaseEvent


class TransactionEvent(BaseEvent):
    key = "transaction"

    def extract_metadata(self, data: MutableMapping[str, Any]) -> dict[str, str]:
        description = get_path(data, "contexts", "trace", "description")
        transaction = get_path(data, "transaction")
        return {"title": description or transaction, "location": transaction}

    def get_location(self, metadata: dict[str, str]) -> str:
        return metadata["location"]
