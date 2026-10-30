from collections.abc import Sequence
from dataclasses import dataclass
from threading import Barrier
from typing import Any, assert_type
from unittest.mock import patch

import pytest
from django.db import connections

from sentry.constants import ObjectStatus
from sentry.inbox.issue import ISSUE_MENTIONED, IssueMentionedData
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.types import (
    SYSTEM_ACTOR,
    InboxActor,
    InboxEventData,
    InboxEventType,
    InboxItemType,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxActorType, InboxItemEvent
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


class StubItemType[SubjectT](InboxItemType[SubjectT]):
    def __init__(self, subject_type: str) -> None:
        self.subject_type = subject_type

    def get_subject_id(self, subject: SubjectT) -> str:
        raise NotImplementedError

    def get_organization_id(self, subject: SubjectT) -> int:
        raise NotImplementedError

    def get_titles(
        self, *, organization: Organization, subject_ids: Sequence[str]
    ) -> dict[str, str]:
        raise NotImplementedError

    def get_url(self, *, organization: Organization, subject_id: str) -> str:
        raise NotImplementedError


@dataclass(frozen=True, kw_only=True)
class SubjectReference:
    organization_id: int
    subject_id: str


class ReferenceItemType(StubItemType[SubjectReference]):
    def get_subject_id(self, subject: SubjectReference) -> str:
        return subject.subject_id

    def get_organization_id(self, subject: SubjectReference) -> int:
        return subject.organization_id


@dataclass(frozen=True, kw_only=True)
class MentionedData(InboxEventData):
    comment_id: int


@patch.dict(inbox_item_type_registry.registrations, clear=True)
@patch.dict(inbox_item_event_type_registry.registrations, clear=True)
def test_register_types() -> None:
    issue_type = StubItemType[Group]("test.issue")
    reference_type = StubItemType[SubjectReference]("test.reference")
    issue_event = InboxEventType(
        event_type="test.issue.mentioned",
        item_type=issue_type,
        data_class=MentionedData,
    )
    reference_event = InboxEventType(
        event_type="test.reference.mentioned",
        item_type=reference_type,
        data_class=MentionedData,
    )
    assert_type(issue_event, InboxEventType[Group, MentionedData])
    assert_type(reference_event, InboxEventType[SubjectReference, MentionedData])
    data = issue_event.data_class(summary="You were mentioned in a comment", comment_id=123)
    assert_type(data, MentionedData)

    inbox_item_type_registry.register(issue_type.subject_type)(issue_type)
    inbox_item_type_registry.register(reference_type.subject_type)(reference_type)
    inbox_item_event_type_registry.register(issue_event.event_type)(issue_event)
    inbox_item_event_type_registry.register(reference_event.event_type)(reference_event)

    assert inbox_item_type_registry.get(issue_type.subject_type) is issue_type
    assert inbox_item_type_registry.get(reference_type.subject_type) is reference_type
    assert inbox_item_event_type_registry.get(issue_event.event_type) is issue_event
    assert inbox_item_event_type_registry.get(reference_event.event_type) is reference_event


def test_actor() -> None:
    assert InboxActor.user(123) == InboxActor(type=InboxActorType.USER, id=123)
    assert SYSTEM_ACTOR == InboxActor(type=InboxActorType.SYSTEM, id=None)


@with_feature("organizations:universal-inbox-recording")
class RecordTest(TestCase):
    def test_user_actor_and_multiple_recipients(self) -> None:
        actor = self.create_user()
        other = self.create_user()

        with patch("sentry.inbox.types.metrics.incr") as incr:
            ISSUE_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(summary="Mentioned you", comment_id=123),
                recipient_user_ids=iter([actor.id, self.user.id, other.id, self.user.id]),
                actor=InboxActor.user(actor.id),
            )

        items = list(InboxItem.objects.order_by("user_id"))
        assert [item.user_id for item in items] == sorted([self.user.id, other.id])
        for item in items:
            event = item.events.get()
            assert item.subject_id == str(self.group.id)
            assert item.subject_type == "issue"
            assert item.organization_id == self.organization.id
            assert item.last_activity_at == event.date_added
            assert item.last_read_at is None
            assert event.actor_type == InboxActorType.USER
            assert event.actor_id == actor.id
            assert event.type == "issue.mentioned"
            assert event.data == {"summary": "Mentioned you", "comment_id": 123}
        incr.assert_any_call(
            "inbox.events.recorded", amount=2, tags={"event_type": "issue.mentioned"}
        )

    def test_no_other_recipients(self) -> None:
        group = self.group
        for recipients in ([], [123, 123]):
            with self.assertNumQueries(0):
                ISSUE_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(summary="Mentioned you", comment_id=123),
                    recipient_user_ids=recipients,
                    actor=InboxActor.user(123),
                )

    def test_recording_flag(self) -> None:
        for recording, ui in [(False, False), (False, True), (True, False), (True, True)]:
            group = self.create_group(project=self.project)
            with (
                self.subTest(recording=recording, ui=ui),
                self.feature(
                    {
                        "organizations:universal-inbox-recording": recording,
                        "organizations:universal-inbox": ui,
                    }
                ),
            ):
                ISSUE_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(summary="Mentioned you", comment_id=123),
                    recipient_user_ids=[self.user.id],
                    actor=SYSTEM_ACTOR,
                )

                assert InboxItem.objects.filter(subject_id=str(group.id)).count() == int(recording)
                assert InboxItemEvent.objects.filter(
                    inbox_item__subject_id=str(group.id)
                ).count() == int(recording)

    def test_record_after_ui_rollback(self) -> None:
        with self.feature("organizations:universal-inbox"):
            ISSUE_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(summary="First mention", comment_id=123),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )
        with self.feature({"organizations:universal-inbox": False}):
            ISSUE_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(summary="Another mention", comment_id=456),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )

        assert InboxItem.objects.count() == 1
        assert list(InboxItemEvent.objects.order_by("id").values_list("data", flat=True)) == [
            {"summary": "First mention", "comment_id": 123},
            {"summary": "Another mention", "comment_id": 456},
        ]

    def test_recording_disabled_preserves_existing_item(self) -> None:
        item = self.create_inbox_item(
            subject_id=str(self.group.id),
            last_activity_at=before_now(days=1),
            status=ObjectStatus.PENDING_DELETION,
        )
        activity_at, updated_at = item.last_activity_at, item.date_updated

        with self.feature({"organizations:universal-inbox-recording": False}):
            ISSUE_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(summary="Mentioned you", comment_id=123),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )

        item.refresh_from_db()
        assert item.last_activity_at == activity_at
        assert item.date_updated == updated_at
        assert item.status == ObjectStatus.PENDING_DELETION
        assert not item.events.exists()

    def test_value_object_subject(self) -> None:
        item_type = ReferenceItemType("test.reference")
        event_type = InboxEventType(
            event_type="test.reference.updated", item_type=item_type, data_class=InboxEventData
        )

        event_type.record(
            subject=SubjectReference(organization_id=self.organization.id, subject_id="period-1"),
            data=InboxEventData(summary="Period updated"),
            recipient_user_ids=[self.user.id],
            actor=SYSTEM_ACTOR,
        )

        item = InboxItem.objects.get()
        assert item.organization_id == self.organization.id
        assert item.subject_type == "test.reference"
        assert item.subject_id == "period-1"
        assert item.events.get().data == {"summary": "Period updated"}

    def test_existing_item_and_system_actor(self) -> None:
        read_at = before_now(days=1)
        item = self.create_inbox_item(
            subject_id=str(self.group.id),
            last_read_at=read_at,
            last_activity_at=before_now(days=2),
            status=ObjectStatus.PENDING_DELETION,
        )
        previous = self.create_inbox_item_event(item, data={"summary": "Previous event"})
        foreign = self.create_inbox_item(
            organization=self.create_organization(), subject_id=str(self.group.id)
        )
        foreign_updated_at = foreign.date_updated

        with patch("sentry.inbox.types.metrics.incr") as incr:
            ISSUE_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(summary="Mentioned you", comment_id=123),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )

        item.refresh_from_db()
        foreign.refresh_from_db()
        event = item.events.exclude(id=previous.id).get()
        assert InboxItem.objects.count() == 2
        assert item.events.count() == 2
        assert item.last_read_at == read_at
        assert item.last_activity_at == event.date_added
        assert item.last_activity_at > read_at
        assert item.status == ObjectStatus.ACTIVE
        assert foreign.date_updated == foreign_updated_at
        assert not foreign.events.exists()
        assert event.actor_type == InboxActorType.SYSTEM
        assert event.actor_id is None
        incr.assert_any_call(
            "inbox.events.recorded", amount=1, tags={"event_type": "issue.mentioned"}
        )

    def test_event_failure_rolls_back_item(self) -> None:
        with (
            patch(
                "sentry.inbox.types.InboxItemEvent.objects.create",
                side_effect=RuntimeError("write failed"),
            ),
            pytest.raises(RuntimeError, match="write failed"),
        ):
            ISSUE_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(summary="Mentioned you", comment_id=123),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )

        assert not InboxItem.objects.exists()
        assert not InboxItemEvent.objects.exists()


@with_feature("organizations:universal-inbox-recording")
class RecordConcurrencyTest(TransactionTestCase):
    def test_concurrent_creates_keep_both_events(self) -> None:
        group, user = self.group, self.user
        ready = Barrier(2, timeout=20)
        save = InboxItem.save

        def concurrent_save(item: InboxItem, *args: Any, **kwargs: Any) -> None:
            ready.wait()
            save(item, *args, **kwargs)

        def record(comment_id: int) -> None:
            try:
                ISSUE_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(summary="Mentioned you", comment_id=comment_id),
                    recipient_user_ids=[user.id],
                    actor=SYSTEM_ACTOR,
                )
            finally:
                connections.close_all()

        with (
            patch.object(InboxItem, "save", concurrent_save),
            ContextPropagatingThreadPoolExecutor(max_workers=2) as executor,
        ):
            futures = [executor.submit(record, comment_id) for comment_id in (123, 456)]
            for future in futures:
                future.result(timeout=30)

        item = InboxItem.objects.get()
        events = list(item.events.order_by("date_added"))
        assert len(events) == 2
        assert {event.data["comment_id"] for event in events} == {123, 456}
        assert item.last_activity_at == events[-1].date_added
