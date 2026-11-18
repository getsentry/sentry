from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass, fields
from typing import Self


@dataclass(frozen=True, kw_only=True)
class InboxEventData(ABC):
    """Event payload, stored as JSON on each recorded event.

    Give fields added to existing payloads a default so retained events can still be rebuilt.
    """

    @classmethod
    def from_payload(cls, payload: Mapping[str, object]) -> Self:
        """Parse trusted recorded data, applying defaults and ignoring unknown keys.

        Required fields must have been written by the producer. Missing fields indicate broken
        recorded data; this does not validate field values or impose new recording rules.
        """
        names = {field.name for field in fields(cls) if field.init}
        return cls(**{key: value for key, value in payload.items() if key in names})

    @abstractmethod
    def serialize(self) -> Mapping[str, object]:
        """Return the API representation, with string IDs and camelCase keys."""

    def get_url(self, subject_url: str) -> str:
        """Override to link to something on the subject's page, such as a comment."""
        return subject_url
