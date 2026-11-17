from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, fields
from typing import Any, Self


@dataclass(frozen=True, kw_only=True)
class InboxEventData:
    """
    Event payload, stored as JSON on each recorded event.

    Give any field added to an existing data class a default. Stored payloads won't have it, and
    rebuilding them without a value fails, so their URLs fall back to the subject URL.
    """

    @classmethod
    def from_payload(cls, payload: Mapping[str, Any]) -> Self:
        """Rebuild from a stored payload, ignoring keys that are no longer fields."""
        names = {field.name for field in fields(cls) if field.init}
        return cls(**{key: value for key, value in payload.items() if key in names})

    def get_url(self, subject_url: str) -> str:
        """
        URL for this event, built from the subject URL. Override to point at something on the
        subject's page, such as the comment that mentioned you.
        """
        return subject_url
