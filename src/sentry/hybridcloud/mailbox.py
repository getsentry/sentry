"""
The name of a webhook mailbox: the parts it is made of, and the string they render to.

Assembled in one place rather than by the several callers that each knew part of the
format.
"""

from __future__ import annotations

from dataclasses import dataclass, replace


@dataclass(frozen=True)
class MailboxName:
    provider: str
    """Leading segment of the name, and the tag the webhook metrics carry."""

    subject: str
    """An integration, an organization, or the provider's own webhook identifier where
    neither resolved."""

    cell: str | None = None
    """Which cell's copy, so each cell's drain independently. Sits in the middle,
    leaving the first segment the provider and the last the event type."""

    event_type: str | None = None
    """Only ever a value the registry knows -- it is read out of a body control has
    not verified."""

    bucket: int | None = None

    def __str__(self) -> str:
        """What a payload is queued under, and what the scheduler drains."""
        parts = [self.provider]
        if self.cell is not None:
            parts.append(self.cell)
        parts.append(self.subject)
        if self.bucket is not None:
            parts.append(str(self.bucket))
        if self.event_type is not None:
            parts.append(self.event_type)
        return ":".join(parts)

    def in_cell(self, cell: str) -> MailboxName:
        return replace(self, cell=cell)

    def in_bucket(self, bucket: int) -> MailboxName:
        return replace(self, bucket=bucket)
