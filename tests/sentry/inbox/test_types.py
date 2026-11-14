from collections.abc import Sequence
from dataclasses import dataclass
from threading import Barrier
from typing import Any, assert_type
from unittest.mock import patch

import pytest
from django.db import connections, router, transaction
from openapi_schema_validator import OAS30Validator

from sentry.apidocs.spectacular_ports import resolve_type_hint
from sentry.constants import ObjectStatus
from sentry.inbox.event_retention import cleanup_inbox_item_events
from sentry.inbox.issue import ISSUE_USER_MENTIONED, IssueMentionedData
from sentry.inbox.registry import inbox_item_event_type_registry, inbox_item_type_registry
from sentry.inbox.response_types import (
    InboxCountResponse,
    InboxItemEventResponse,
    InboxItemResponse,
)
from sentry.inbox.types import (
    SYSTEM_ACTOR,
    InboxActor,
    InboxEventData,
    InboxEventSummary,
    InboxEventType,
    InboxItemType,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notifications.models.inboxitem import InboxItem
from sentry.notifications.models.inboxitemevent import InboxActorType, InboxItemEvent
from sentry.notifications.types import NotificationSettingEnum
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import BurstTaskRunner
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.query import bulk_delete_objects


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

    def filter_recipients(self, *, subject: SubjectT, user_ids: Sequence[int]) -> list[int]:
        return list(user_ids)


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


@pytest.mark.parametrize(
    "response_type", [InboxItemResponse, InboxItemEventResponse, InboxCountResponse]
)
def test_response_types_support_openapi(response_type: type) -> None:
    OAS30Validator.check_schema(resolve_type_hint(response_type))


@patch.dict(inbox_item_type_registry.registrations, clear=True)
@patch.dict(inbox_item_event_type_registry.registrations, clear=True)
def test_register_types() -> None:
    issue_type = StubItemType[Group]("test.issue")
    reference_type = StubItemType[SubjectReference]("test.reference")
    issue_event = InboxEventType(
        event_type="test.issue.user_mentioned",
        summary=InboxEventSummary.ISSUE_USER_MENTIONED,
        item_type=issue_type,
        data_class=MentionedData,
        notification_setting=NotificationSettingEnum.INBOX_MENTIONS,
    )
    reference_event = InboxEventType(
        event_type="test.reference.mentioned",
        summary=InboxEventSummary.NOTEBOOK_MENTIONED,
        item_type=reference_type,
        data_class=MentionedData,
        notification_setting=NotificationSettingEnum.INBOX_MENTIONS,
    )
    assert_type(issue_event, InboxEventType[Group, MentionedData])
    assert_type(reference_event, InboxEventType[SubjectReference, MentionedData])
    data = issue_event.data_class(comment_id=123)
    assert_type(data, MentionedData)

    inbox_item_type_registry.register(issue_type.subject_type)(issue_type)
    inbox_item_type_registry.register(reference_type.subject_type)(reference_type)
    inbox_item_event_type_registry.register(issue_event.event_type)(issue_event)
    inbox_item_event_type_registry.register(reference_event.event_type)(reference_event)

    assert inbox_item_type_registry.get(issue_type.subject_type) is issue_type
    assert inbox_item_type_registry.get(reference_type.subject_type) is reference_type
    assert inbox_item_event_type_registry.get(issue_event.event_type) is issue_event
    assert inbox_item_event_type_registry.get(reference_event.event_type) is reference_event


def test_registered_event_notification_settings() -> None:
    assert {
        event_type: registered.notification_setting
        for event_type, registered in inbox_item_event_type_registry.registrations.items()
    } == {
        "issue.user_assigned": NotificationSettingEnum.INBOX_ASSIGNMENTS,
        "issue.team_assigned": NotificationSettingEnum.INBOX_ASSIGNMENTS,
        "issue.user_mentioned": NotificationSettingEnum.INBOX_MENTIONS,
        "issue.team_mentioned": NotificationSettingEnum.INBOX_MENTIONS,
        "issue.pr_ready_for_review": NotificationSettingEnum.INBOX_PULL_REQUESTS_READY,
        "notebook.completed": NotificationSettingEnum.INBOX_COMPLETION_STATUS,
        "notebook.user_mentioned": NotificationSettingEnum.INBOX_MENTIONS,
        "notebook.team_mentioned": NotificationSettingEnum.INBOX_MENTIONS,
        "notebook.participant_added": NotificationSettingEnum.INBOX_ASSIGNMENTS,
    }


def test_actor() -> None:
    assert InboxActor.user(123) == InboxActor(type=InboxActorType.USER, id=123)
    assert SYSTEM_ACTOR == InboxActor(type=InboxActorType.SYSTEM, id=None)


class InboxEventRetentionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(self.options({"cleanup.inbox-events.enabled": True}))

    def _cleanup(self, item: InboxItem) -> None:
        with BurstTaskRunner() as drain:
            cleanup_inbox_item_events(item_id=item.id)
            drain()

    def test_disabled_cleanup_preserves_events(self) -> None:
        item = self.create_inbox_item()
        for _ in range(3):
            self.create_inbox_item_event(item)
        with (
            self.options({"cleanup.inbox-events.enabled": False}),
            patch("sentry.inbox.event_retention.MAX_EVENTS_PER_ITEM", 1),
            patch.object(cleanup_inbox_item_events, "delay") as enqueue,
        ):
            cleanup_inbox_item_events(item_id=item.id)
        enqueue.assert_not_called()
        assert item.events.count() == 3

    def test_event_limits_and_timestamp_ties(self) -> None:
        timestamp = before_now(days=365)
        for event_count in [99, 100, 103]:
            item = self.create_inbox_item(subject_id=str(event_count), last_activity_at=timestamp)
            events = [self.create_inbox_item_event(item) for _ in range(event_count)]
            item.events.update(date_added=timestamp)
            self._cleanup(item)
            assert list(item.events.order_by("id").values_list("id", flat=True)) == [
                event.id for event in events[-100:]
            ]

    def test_under_limit_only_reads_events(self) -> None:
        item = self.create_inbox_item()
        self.create_inbox_item_event(item)
        with (
            patch.object(cleanup_inbox_item_events, "delay") as enqueue,
            self.assertNumQueries(1),
        ):
            cleanup_inbox_item_events(item_id=item.id)
        enqueue.assert_not_called()
        assert item.events.count() == 1

    def test_event_retention_uses_timestamp_before_id(self) -> None:
        item = self.create_inbox_item()
        recent = self.create_inbox_item_event(item)
        older = self.create_inbox_item_event(item)
        item.events.filter(id=older.id).update(date_added=before_now(days=1))

        with patch("sentry.inbox.event_retention.MAX_EVENTS_PER_ITEM", 1):
            self._cleanup(item)

        assert item.events.get().id == recent.id

    def test_missing_item_is_ignored(self) -> None:
        with patch.object(cleanup_inbox_item_events, "delay") as enqueue:
            cleanup_inbox_item_events(item_id=0)
        enqueue.assert_not_called()

    def test_cleanup_is_scoped_to_the_item(self) -> None:
        item = self.create_inbox_item()
        other_user = self.create_inbox_item(user=self.create_user())
        other_org = self.create_inbox_item(organization=self.create_organization())
        for inbox_item in [item, other_user, other_org]:
            for _ in range(3):
                self.create_inbox_item_event(inbox_item)
        with patch("sentry.inbox.event_retention.MAX_EVENTS_PER_ITEM", 1):
            self._cleanup(item)
        assert item.events.count() == 1
        assert other_user.events.count() == 3
        assert other_org.events.count() == 3
        assert InboxItem.objects.count() == 3

    def test_event_cleanup_continues_in_batches(self) -> None:
        item = self.create_inbox_item()
        events = [self.create_inbox_item_event(item) for _ in range(7)]
        with (
            patch("sentry.inbox.event_retention.MAX_EVENTS_PER_ITEM", 2),
            patch("sentry.inbox.event_retention.DELETE_BATCH_SIZE", 2),
            BurstTaskRunner() as drain,
        ):
            cleanup_inbox_item_events(item_id=item.id)
            assert item.events.count() == 5
            assert len(drain.queue) == 1
            drain()
        assert list(item.events.order_by("id").values_list("id", flat=True)) == [
            event.id for event in events[-2:]
        ]

    @with_feature(
        {"organizations:universal-inbox-recording": True, "organizations:universal-inbox": False}
    )
    @override_options({"cleanup.inbox-events.sample-rate": 1.0})
    def test_sampled_write_trims_events_with_ui_disabled(self) -> None:
        item = self.create_inbox_item(subject_id=str(self.group.id))
        self.create_inbox_item_event(item)
        with (
            patch("sentry.inbox.event_retention.MAX_EVENTS_PER_ITEM", 1),
            BurstTaskRunner() as drain,
        ):
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(comment_id=123),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )
            drain()
        assert item.events.get().data["comment_id"] == 123

    def test_concurrent_recording_can_leave_overflow_until_next_sweep(self) -> None:
        item = self.create_inbox_item()
        events = [self.create_inbox_item_event(item) for _ in range(3)]

        def record_before_delete(**kwargs: Any) -> bool:
            self.create_inbox_item_event(item)
            return bulk_delete_objects(**kwargs)

        with patch("sentry.inbox.event_retention.MAX_EVENTS_PER_ITEM", 1):
            with patch(
                "sentry.inbox.event_retention.bulk_delete_objects", side_effect=record_before_delete
            ):
                cleanup_inbox_item_events(item_id=item.id)
            assert item.events.count() == 2
            assert item.events.filter(id=events[-1].id).exists()
            self._cleanup(item)
        assert item.events.count() == 1
        assert not item.events.filter(id__in=[event.id for event in events]).exists()


@with_feature("organizations:universal-inbox-recording")
class RecordTest(TestCase):
    @override_options(
        {"cleanup.inbox-events.enabled": True, "cleanup.inbox-events.sample-rate": 0.5}
    )
    def test_retention_samples_each_recipient_after_commit(self) -> None:
        group = self.group
        other = self.create_user()
        self.create_member(user=other, organization=self.organization)
        first, second = sorted([self.user.id, other.id])
        with (
            patch("sentry.inbox.types.random", side_effect=[0.1, 0.9]),
            patch.object(cleanup_inbox_item_events, "delay") as enqueue,
        ):
            with transaction.atomic(using=router.db_for_write(InboxItem)):
                ISSUE_USER_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(comment_id=123),
                    recipient_user_ids=[first, second],
                    actor=SYSTEM_ACTOR,
                )
                enqueue.assert_not_called()

        enqueue.assert_called_once_with(item_id=InboxItem.objects.get(user_id=first).id)

    @override_options(
        {"cleanup.inbox-events.enabled": True, "cleanup.inbox-events.sample-rate": 1.0}
    )
    def test_rolled_back_write_does_not_enqueue_cleanup(self) -> None:
        group, user = self.group, self.user
        with (
            patch.object(cleanup_inbox_item_events, "delay") as enqueue,
            pytest.raises(RuntimeError, match="rollback"),
            transaction.atomic(using=router.db_for_write(InboxItem)),
        ):
            ISSUE_USER_MENTIONED.record(
                subject=group,
                data=IssueMentionedData(comment_id=123),
                recipient_user_ids=[user.id],
                actor=SYSTEM_ACTOR,
            )
            raise RuntimeError("rollback")

        enqueue.assert_not_called()

    def test_user_actor_and_multiple_recipients(self) -> None:
        actor = self.create_user()
        other = self.create_user()

        with patch("sentry.inbox.types.metrics.incr") as incr:
            recorded = ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(comment_id=123),
                recipient_user_ids=iter([actor.id, self.user.id, other.id, self.user.id]),
                actor=InboxActor.user(actor.id),
            )

        items = list(InboxItem.objects.order_by("user_id"))
        assert [item.user_id for item in items] == sorted([self.user.id, other.id])
        assert sorted((event.inbox_item.id, event.id) for event in recorded) == sorted(
            (item.id, item.events.get().id) for item in items
        )
        for item in items:
            event = item.events.get()
            assert item.subject_id == str(self.group.id)
            assert item.subject_type == "issue"
            assert item.organization_id == self.organization.id
            assert item.last_activity_at == event.date_added
            assert item.last_read_at is None
            assert event.actor_type == InboxActorType.USER
            assert event.actor_id == actor.id
            assert event.type == "issue.user_mentioned"
            assert event.data == {"comment_id": 123}
        incr.assert_any_call(
            "inbox.events.recorded", amount=2, tags={"event_type": "issue.user_mentioned"}
        )

    def test_no_other_recipients(self) -> None:
        group = self.group
        for recipients in ([], [123, 123]):
            with self.assertNumQueries(0):
                recorded = ISSUE_USER_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(comment_id=123),
                    recipient_user_ids=recipients,
                    actor=InboxActor.user(123),
                )
            assert recorded == []

    @override_options({"cleanup.inbox-events.enabled": False})
    def test_query_count_for_multiple_recipients(self) -> None:
        group = self.group
        recipients = [self.user.id, *[self.create_user().id for _ in range(19)]]
        Organization.objects.get_from_cache(id=self.organization.id)

        for user_ids in ([recipients[0]], recipients, list(reversed(recipients))):
            with self.subTest(recipient_count=len(user_ids)), self.assertNumQueries(5):
                ISSUE_USER_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(comment_id=123),
                    recipient_user_ids=user_ids,
                    actor=SYSTEM_ACTOR,
                )

        assert InboxItem.objects.count() == 20
        assert InboxItemEvent.objects.count() == 41

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
                ISSUE_USER_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(comment_id=123),
                    recipient_user_ids=[self.user.id],
                    actor=SYSTEM_ACTOR,
                )

                assert InboxItem.objects.filter(subject_id=str(group.id)).count() == int(recording)
                assert InboxItemEvent.objects.filter(
                    inbox_item__subject_id=str(group.id)
                ).count() == int(recording)

    def test_record_after_ui_rollback(self) -> None:
        with self.feature("organizations:universal-inbox"):
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(comment_id=123),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )
        with self.feature({"organizations:universal-inbox": False}):
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(comment_id=456),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )

        assert InboxItem.objects.count() == 1
        assert list(InboxItemEvent.objects.order_by("id").values_list("data", flat=True)) == [
            {"comment_id": 123},
            {"comment_id": 456},
        ]

    def test_recording_disabled_preserves_existing_item(self) -> None:
        item = self.create_inbox_item(
            subject_id=str(self.group.id),
            last_activity_at=before_now(days=1),
            status=ObjectStatus.PENDING_DELETION,
        )
        activity_at, updated_at = item.last_activity_at, item.date_updated

        with self.feature({"organizations:universal-inbox-recording": False}):
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(comment_id=123),
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
            event_type="test.reference.updated",
            summary=InboxEventSummary.ISSUE_USER_MENTIONED,
            item_type=item_type,
            data_class=InboxEventData,
            notification_setting=NotificationSettingEnum.INBOX_MENTIONS,
        )

        event_type.record(
            subject=SubjectReference(organization_id=self.organization.id, subject_id="period-1"),
            data=InboxEventData(),
            recipient_user_ids=[self.user.id],
            actor=SYSTEM_ACTOR,
        )

        item = InboxItem.objects.get()
        assert item.organization_id == self.organization.id
        assert item.subject_type == "test.reference"
        assert item.subject_id == "period-1"
        assert item.events.get().data == {}

    def test_existing_item_and_system_actor(self) -> None:
        read_at = before_now(days=1)
        item = self.create_inbox_item(
            subject_id=str(self.group.id),
            last_read_at=read_at,
            last_activity_at=before_now(days=2),
            status=ObjectStatus.PENDING_DELETION,
        )
        previous = self.create_inbox_item_event(item, data={})
        foreign = self.create_inbox_item(
            organization=self.create_organization(), subject_id=str(self.group.id)
        )
        foreign_updated_at = foreign.date_updated

        with patch("sentry.inbox.types.metrics.incr") as incr:
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(comment_id=123),
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
            "inbox.events.recorded", amount=1, tags={"event_type": "issue.user_mentioned"}
        )

    def test_event_failure_rolls_back_item(self) -> None:
        with (
            patch(
                "sentry.inbox.types.InboxItemEvent.objects.bulk_create",
                side_effect=RuntimeError("write failed"),
            ),
            pytest.raises(RuntimeError, match="write failed"),
        ):
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(comment_id=123),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )

        assert not InboxItem.objects.exists()
        assert not InboxItemEvent.objects.exists()

    def test_update_failure_rolls_back_fanout(self) -> None:
        read_at = before_now(days=1)
        item = self.create_inbox_item(
            subject_id=str(self.group.id),
            last_read_at=read_at,
            last_activity_at=before_now(days=2),
            status=ObjectStatus.PENDING_DELETION,
        )
        activity_at, updated_at = item.last_activity_at, item.date_updated
        other = self.create_user()

        with (
            patch(
                "sentry.inbox.types.InboxItem.objects.bulk_update",
                side_effect=RuntimeError("write failed"),
            ),
            pytest.raises(RuntimeError, match="write failed"),
        ):
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(comment_id=123),
                recipient_user_ids=[self.user.id, other.id],
                actor=SYSTEM_ACTOR,
            )

        item.refresh_from_db()
        assert InboxItem.objects.count() == 1
        assert item.status == ObjectStatus.PENDING_DELETION
        assert item.last_read_at == read_at
        assert item.last_activity_at == activity_at
        assert item.date_updated == updated_at
        assert not InboxItemEvent.objects.exists()

    def test_activity_timestamp_does_not_move_backwards(self) -> None:
        activity_at = before_now(days=-1)
        item = self.create_inbox_item(subject_id=str(self.group.id), last_activity_at=activity_at)

        ISSUE_USER_MENTIONED.record(
            subject=self.group,
            data=IssueMentionedData(comment_id=123),
            recipient_user_ids=[self.user.id],
            actor=SYSTEM_ACTOR,
        )

        item.refresh_from_db()
        assert item.last_activity_at == activity_at
        assert item.date_updated == item.events.get().date_added


@with_feature("organizations:universal-inbox-recording")
class RecordConcurrencyTest(TransactionTestCase):
    def _record_concurrently(self, recipient_user_ids: list[int]) -> None:
        group = self.group
        ready = Barrier(2, timeout=20)
        bulk_create = InboxItem.objects.bulk_create

        def concurrent_create(items: list[InboxItem], **kwargs: Any) -> list[InboxItem]:
            ready.wait()
            return bulk_create(items, **kwargs)

        def record(comment_id: int, user_ids: list[int]) -> None:
            try:
                ISSUE_USER_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(comment_id=comment_id),
                    recipient_user_ids=user_ids,
                    actor=SYSTEM_ACTOR,
                )
            finally:
                connections.close_all()

        with (
            patch.object(InboxItem.objects, "bulk_create", concurrent_create),
            ContextPropagatingThreadPoolExecutor(max_workers=2) as executor,
        ):
            futures = [
                executor.submit(record, 123, recipient_user_ids),
                executor.submit(record, 456, list(reversed(recipient_user_ids))),
            ]
            for future in futures:
                future.result(timeout=30)

    def test_concurrent_creates_keep_both_events(self) -> None:
        recipients = [self.user.id, self.create_user().id]

        self._record_concurrently(recipients)

        assert InboxItem.objects.count() == 2
        for item in InboxItem.objects.all():
            events = list(item.events.order_by("date_added"))
            assert len(events) == 2
            assert {event.data["comment_id"] for event in events} == {123, 456}
            assert item.last_activity_at == events[-1].date_added

    def test_concurrent_fanout_to_existing_and_new_items(self) -> None:
        read_at = before_now(days=1)
        existing = self.create_inbox_item(
            subject_id=str(self.group.id),
            last_read_at=read_at,
            last_activity_at=before_now(days=2),
            status=ObjectStatus.PENDING_DELETION,
        )
        recipients = [self.user.id, self.create_user().id, self.create_user().id]

        self._record_concurrently(recipients)

        assert InboxItem.objects.count() == 3
        for item in InboxItem.objects.all():
            events = list(item.events.order_by("date_added"))
            assert len(events) == 2
            assert {event.data["comment_id"] for event in events} == {123, 456}
            assert item.last_activity_at == events[-1].date_added
            assert item.status == ObjectStatus.ACTIVE
        existing.refresh_from_db()
        assert existing.last_read_at == read_at
