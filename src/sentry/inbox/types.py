from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from sentry.models.organization import Organization
from sentry.notifications.models.inboxitemevent import InboxActorType


@dataclass(frozen=True, kw_only=True)
class InboxActor:
    type: InboxActorType
    id: int | None

    @classmethod
    def user(cls, user_id: int) -> InboxActor:
        return cls(type=InboxActorType.USER, id=user_id)


SYSTEM_ACTOR = InboxActor(type=InboxActorType.SYSTEM, id=None)


class InboxItemType[SubjectT](ABC):
    """Groups activity for the same subject into one inbox item per recipient."""

    subject_type: str

    @abstractmethod
    def get_subject_id(self, subject: SubjectT) -> str:
        """Stable subject ID used to group events."""

    @abstractmethod
    def get_organization_id(self, subject: SubjectT) -> int: ...

    @abstractmethod
    def get_titles(
        self, *, organization: Organization, subject_ids: Sequence[str]
    ) -> dict[str, str]:
        """Titles keyed by subject ID, scoped to organization. Omit missing subjects."""

    @abstractmethod
    def get_url(self, *, organization: Organization, subject_id: str) -> str:
        """Subject URL, independent of inbox items or events."""


@dataclass(frozen=True, kw_only=True)
class InboxEventData:
    """
    Stored JSON payload with a producer-supplied summary.
    Add fields with defaults so existing events remain readable.
    """

    summary: str


@dataclass(frozen=True, kw_only=True)
class InboxEventType[SubjectT, DataT: InboxEventData]:
    """Keep event_type stable so retained events can be looked up."""

    event_type: str
    item_type: InboxItemType[SubjectT]
    data_class: type[DataT]

    def record(
        self,
        *,
        subject: SubjectT,
        data: DataT,
        recipient_user_ids: Iterable[int],
        actor: InboxActor,
    ) -> None:
        raise NotImplementedError
