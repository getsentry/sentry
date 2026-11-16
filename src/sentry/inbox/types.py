from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from enum import StrEnum
from functools import partial
from random import random
from typing import Literal

import orjson
from django.db import router, transaction
from django.db.models.functions import Greatest
from django.utils import timezone

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.inbox.event_retention import cleanup_inbox_item_events
from sentry.inbox.item_retention import cleanup_inbox_items
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxActorType, InboxItemEvent
from sentry.notifications.types import NotificationSettingEnum
from sentry.utils import metrics
from sentry.utils.safe import safe_execute


@dataclass(frozen=True, kw_only=True)
class InboxActor:
    type: InboxActorType
    id: int | None

    @classmethod
    def user(cls, user_id: int) -> InboxActor:
        return cls(type=InboxActorType.USER, id=user_id)


SYSTEM_ACTOR = InboxActor(type=InboxActorType.SYSTEM, id=None)


def _schedule_item_retention(items: Sequence[InboxItem]) -> None:
    if not options.get("cleanup.inbox-items.enabled"):
        return

    rate = options.get("cleanup.inbox-items.sample-rate")
    for item in items:
        if random() < rate:
            safe_execute(
                cleanup_inbox_items.delay,
                organization_id=item.organization_id,
                user_id=item.user_id,
            )


def _schedule_event_retention(items: Sequence[InboxItem]) -> None:
    if not options.get("cleanup.inbox-events.enabled"):
        return

    rate = options.get("cleanup.inbox-events.sample-rate")
    for item in items:
        if random() < rate:
            safe_execute(cleanup_inbox_item_events.delay, item_id=item.id)


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
        """Subject's inbox URL, independent of recorded inbox items or events."""

    @abstractmethod
    def filter_recipients(self, *, subject: SubjectT, user_ids: Sequence[int]) -> list[int]:
        """The given users who are allowed to see the subject."""


class InboxEventSummary(StrEnum):
    ISSUE_USER_ASSIGNED = "Assigned to you"
    ISSUE_TEAM_ASSIGNED = "Assigned to your team"
    ISSUE_USER_MENTIONED = "Mentioned you in a comment"
    ISSUE_TEAM_MENTIONED = "Mentioned your team in a comment"
    ISSUE_PR_READY_FOR_REVIEW = "Pull request ready for review"
    NOTEBOOK_COMPLETED = "Investigation completed"
    NOTEBOOK_USER_MENTIONED = "Mentioned you"
    NOTEBOOK_TEAM_MENTIONED = "Mentioned your team"
    NOTEBOOK_PARTICIPANT_ADDED = "Added you"


@dataclass(frozen=True, kw_only=True)
class InboxEventData:
    def get_url(self, subject_url: str) -> str:
        """
        URL for this event, built from the subject URL. Override to point at something on the
        subject's page, such as the comment that mentioned you.
        """
        return subject_url


@dataclass(frozen=True, kw_only=True)
class InboxEventType[SubjectT, DataT: InboxEventData]:
    """Keep event_type stable so retained events can be looked up."""

    event_type: str
    summary: InboxEventSummary
    item_type: InboxItemType[SubjectT]
    data_class: type[DataT]
    # Personal notification setting category that controls email and Slack for this event.
    notification_setting: NotificationSettingEnum
    recipient: Literal["team", "user"] = "user"

    def get_idempotency_key(self, *, data: DataT) -> str:
        return hashlib.sha256(orjson.dumps(asdict(data), option=orjson.OPT_SORT_KEYS)).hexdigest()

    def get_url(self, *, organization: Organization, subject_id: str, data: DataT) -> str:
        """URL for an event of this type."""
        subject_url = self.item_type.get_url(organization=organization, subject_id=subject_id)
        return data.get_url(subject_url)

    def record(
        self,
        *,
        subject: SubjectT,
        data: DataT,
        recipient_user_ids: Iterable[int],
        actor: InboxActor,
    ) -> list[InboxItemEvent]:
        """Return newly created events, with their inbox items attached."""
        recipients = set(recipient_user_ids)
        if actor.type == InboxActorType.USER:
            recipients -= {actor.id}
        if not recipients:
            return []

        organization = Organization.objects.get_from_cache(
            id=self.item_type.get_organization_id(subject)
        )
        if not features.has("organizations:universal-inbox-recording", organization):
            return []

        subject_id = self.item_type.get_subject_id(subject)
        idempotency_key = self.get_idempotency_key(data=data)
        payload = asdict(data)
        tags = {"event_type": self.event_type}
        using = router.db_for_write(InboxItem)

        with (
            metrics.timer("inbox.record.duration", tags=tags),
            transaction.atomic(using=using),
        ):
            items = InboxItem.objects.bulk_create(
                [
                    InboxItem(
                        organization=organization,
                        user_id=user_id,
                        subject_type=self.item_type.subject_type,
                        subject_id=subject_id,
                        last_activity_at=timezone.now(),
                        status=ObjectStatus.ACTIVE,
                    )
                    for user_id in sorted(recipients)
                ],
                update_conflicts=True,
                unique_fields=["user_id", "organization", "subject_type", "subject_id"],
                update_fields=["status"],
            )
            events = []
            for item in items:
                event, created = InboxItemEvent.objects.get_or_create(
                    inbox_item=item,
                    type=self.event_type,
                    idempotency_key=idempotency_key,
                    defaults={
                        "actor_type": actor.type,
                        "actor_id": actor.id,
                        "data": payload,
                    },
                )
                if created:
                    events.append(event)
                activity_at = event.date_added if created else timezone.now()
                item.last_activity_at = Greatest("last_activity_at", activity_at)
                item.date_updated = activity_at
            transaction.on_commit(
                partial(_schedule_item_retention, items),
                using=router.db_for_write(InboxItem),
            )
            transaction.on_commit(
                partial(_schedule_event_retention, items),
                using=router.db_for_write(InboxItem),
            )
            InboxItem.objects.bulk_update(items, ["last_activity_at", "date_updated"])

            transaction.on_commit(
                lambda: metrics.incr("inbox.events.processed", amount=len(recipients), tags=tags),
                using=using,
            )
        return events
