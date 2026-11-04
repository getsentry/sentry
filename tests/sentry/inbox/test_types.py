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
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.inbox.event_retention import (
    cleanup_inbox_item_events,
    schedule_inbox_event_cleanup,
)
from sentry.inbox.issue import ISSUE_USER_MENTIONED, IssueMentionedData
from sentry.inbox.item_retention import (
    cleanup_inbox_items,
    schedule_inbox_item_cleanup,
    schedule_organization_inbox_item_cleanup,
)
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
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
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
    data = issue_event.data_class(summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123)
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
            patch.object(schedule_inbox_event_cleanup, "delay") as next_page,
        ):
            schedule_inbox_event_cleanup()
            cleanup_inbox_item_events(item_id=item.id)
        enqueue.assert_not_called()
        next_page.assert_not_called()
        assert item.events.count() == 3

    def test_next_sweep_revisits_items(self) -> None:
        item = self.create_inbox_item()
        self._cleanup(item)
        with patch.object(cleanup_inbox_item_events, "delay") as enqueue:
            schedule_inbox_event_cleanup()
        enqueue.assert_called_once_with(item_id=item.id)

    def test_schedule_items_with_pagination(self) -> None:
        items = [self.create_inbox_item(subject_id=str(index)) for index in range(3)]
        with (
            patch("sentry.inbox.event_retention.SCHEDULE_BATCH_SIZE", 2),
            patch.object(cleanup_inbox_item_events, "delay") as enqueue,
            patch.object(schedule_inbox_event_cleanup, "delay") as next_page,
        ):
            schedule_inbox_event_cleanup()
            assert enqueue.call_count == 2
            next_page.assert_called_once_with(after_item_id=items[1].id)
            schedule_inbox_event_cleanup(**next_page.call_args.kwargs)
        assert [call.kwargs["item_id"] for call in enqueue.call_args_list] == [
            item.id for item in items
        ]
        next_page.assert_called_once()

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

    def test_new_events_are_cleaned_on_the_next_sweep_with_ui_disabled(self) -> None:
        item = self.create_inbox_item(subject_id=str(self.group.id))
        self.create_inbox_item_event(item)
        self._cleanup(item)
        with self.feature(
            {
                "organizations:universal-inbox-recording": True,
                "organizations:universal-inbox": False,
            }
        ):
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(
                    summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                ),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )
        with patch.object(cleanup_inbox_item_events, "delay") as enqueue:
            schedule_inbox_event_cleanup()
        enqueue.assert_called_once_with(item_id=item.id)
        with (
            self.feature(
                {
                    "organizations:universal-inbox-recording": False,
                    "organizations:universal-inbox": False,
                }
            ),
            patch("sentry.inbox.event_retention.MAX_EVENTS_PER_ITEM", 1),
        ):
            self._cleanup(item)
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


class InboxItemRetentionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(self.options({"cleanup.inbox-items.enabled": True}))

    def _cleanup(self) -> None:
        with BurstTaskRunner() as drain:
            cleanup_inbox_items(organization_id=self.organization.id, user_id=self.user.id)
            drain()

    def test_item_limit_and_timestamp_ties(self) -> None:
        timestamp = before_now(days=365)
        items = [
            self.create_inbox_item(subject_id=str(index), last_activity_at=timestamp)
            for index in range(2_000)
        ]
        event = self.create_inbox_item_event(items[0])
        recent = self.create_inbox_item(subject_id="recent")
        self._cleanup()
        items[0].refresh_from_db()
        assert items[0].status == ObjectStatus.PENDING_DELETION
        assert items[0].events.filter(id=event.id).exists()
        assert InboxItem.objects.filter(status=ObjectStatus.ACTIVE).count() == 2_000
        assert CellScheduledDeletion.objects.filter(
            model_name="InboxItem", object_id=items[0].id
        ).exists()
        assert InboxItem.objects.filter(id=recent.id, status=ObjectStatus.ACTIVE).exists()
        with self.tasks():
            run_scheduled_deletions()
        assert not InboxItem.objects.filter(id=items[0].id).exists()
        assert not InboxItemEvent.objects.filter(id=event.id).exists()
        assert InboxItem.objects.count() == 2_000

    def test_disabled_cleanup_preserves_items(self) -> None:
        old = self.create_inbox_item(subject_id="old", last_activity_at=before_now(days=1))
        self.create_inbox_item(subject_id="recent")
        with (
            self.options({"cleanup.inbox-items.enabled": False}),
            patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 1),
            patch.object(cleanup_inbox_items, "delay") as enqueue,
            patch("sentry.inbox.item_retention.CursoredScheduler") as scheduler,
            patch.object(schedule_organization_inbox_item_cleanup, "delay") as organization_page,
        ):
            schedule_inbox_item_cleanup()
            schedule_organization_inbox_item_cleanup(self.organization.id)
            cleanup_inbox_items(organization_id=self.organization.id, user_id=self.user.id)
        enqueue.assert_not_called()
        scheduler.assert_not_called()
        organization_page.assert_not_called()
        old.refresh_from_db()
        assert old.status == ObjectStatus.ACTIVE
        assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()

    def test_cleanup_is_scoped_to_the_inbox(self) -> None:
        old = self.create_inbox_item(subject_id="old", last_activity_at=before_now(days=1))
        event = self.create_inbox_item_event(old)
        current = self.create_inbox_item(subject_id="current", subject_type="test.reference")
        other_user = self.create_inbox_item(user=self.create_user())
        other_org = self.create_inbox_item(organization=self.create_organization())
        with patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 1):
            self._cleanup()
        assert set(
            InboxItem.objects.filter(status=ObjectStatus.ACTIVE).values_list("id", flat=True)
        ) == {current.id, other_user.id, other_org.id}
        assert InboxItemEvent.objects.filter(id=event.id).exists()
        assert list(
            CellScheduledDeletion.objects.filter(model_name="InboxItem").values_list(
                "object_id", flat=True
            )
        ) == [old.id]

    def test_scheduling_continues_in_batches_and_ignores_pending_items(self) -> None:
        pending = self.create_inbox_item(subject_id="pending", status=ObjectStatus.PENDING_DELETION)
        items = [self.create_inbox_item(subject_id=str(index)) for index in range(4)]
        with (
            patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 1),
            patch("sentry.inbox.item_retention.ITEM_BATCH_SIZE", 1),
            BurstTaskRunner() as drain,
        ):
            cleanup_inbox_items(organization_id=self.organization.id, user_id=self.user.id)
            assert CellScheduledDeletion.objects.filter(model_name="InboxItem").count() == 1
            assert len(drain.queue) == 1
            drain()
        assert list(
            InboxItem.objects.filter(status=ObjectStatus.ACTIVE).values_list("id", flat=True)
        ) == [items[-1].id]
        assert set(
            CellScheduledDeletion.objects.filter(model_name="InboxItem").values_list(
                "object_id", flat=True
            )
        ) == {item.id for item in items[:-1]}
        assert InboxItem.objects.filter(id=pending.id).exists()

    def test_new_activity_cancels_deletion_with_ui_disabled(self) -> None:
        old = self.create_inbox_item(
            subject_id=str(self.group.id), last_activity_at=before_now(days=1)
        )
        original_event = self.create_inbox_item_event(old)
        current = self.create_inbox_item(subject_id="current", last_activity_at=before_now(hours=1))

        with (
            self.feature(
                {
                    "organizations:universal-inbox-recording": True,
                    "organizations:universal-inbox": False,
                }
            ),
            patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 1),
        ):
            self._cleanup()
            assert CellScheduledDeletion.objects.filter(
                model_name="InboxItem", object_id=old.id
            ).exists()

            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(
                    summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                ),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )
            with self.tasks():
                run_scheduled_deletions()

            old.refresh_from_db()
            assert old.status == ObjectStatus.ACTIVE
            assert old.events.count() == 2
            assert old.events.filter(id=original_event.id).exists()
            assert old.events.filter(data__comment_id=123).exists()
            assert not CellScheduledDeletion.objects.filter(
                model_name="InboxItem", object_id=old.id
            ).exists()

            self._cleanup()
            with self.tasks():
                run_scheduled_deletions()

        assert not InboxItem.objects.filter(id=current.id).exists()
        assert InboxItem.objects.filter(id=old.id, status=ObjectStatus.ACTIVE).exists()
        assert InboxItem.objects.count() == 1
        assert old.events.count() == 2

    def test_schedule_active_organizations_across_ticks(self) -> None:
        organizations = [self.organization, self.create_organization(), self.create_organization()]
        for organization in organizations:
            self.create_inbox_item(organization=organization, subject_id="first")
            self.create_inbox_item(organization=organization, subject_id="second")
        self.create_inbox_item(
            organization=self.create_organization(), status=ObjectStatus.PENDING_DELETION
        )
        self.create_organization()

        with (
            freeze_time() as clock,
            patch.object(schedule_organization_inbox_item_cleanup, "delay") as enqueue,
        ):
            schedule_inbox_item_cleanup()
            enqueue.assert_called_once_with(organizations[0].id)
            new_organization = self.create_organization()
            self.create_inbox_item(organization=new_organization)
            schedule_inbox_item_cleanup()
            schedule_inbox_item_cleanup()
            assert [call.args[0] for call in enqueue.call_args_list] == [
                organization.id for organization in organizations
            ]

            # Finishing the snapshot does not start another pass before the cycle is due.
            schedule_inbox_item_cleanup()
            schedule_inbox_item_cleanup()
            assert enqueue.call_count == 3
            enqueue.reset_mock()
            clock.shift(15 * 60)
            schedule_inbox_item_cleanup()
            enqueue.assert_not_called()
            clock.shift(24 * 60 * 60 - 15 * 60 - 1)
            schedule_inbox_item_cleanup()
            enqueue.assert_not_called()
            clock.shift(1)
            schedule_inbox_item_cleanup()
            enqueue.assert_called_once_with(organizations[0].id)
            schedule_inbox_item_cleanup()
            schedule_inbox_item_cleanup()
            schedule_inbox_item_cleanup()
            assert [call.args[0] for call in enqueue.call_args_list] == [
                organization.id for organization in [*organizations, new_organization]
            ]

    def test_schedule_active_inboxes_with_pagination(self) -> None:
        other_org = self.create_organization()
        recipients = [self.user, self.create_user(), self.create_user()]
        for user in recipients:
            self.create_inbox_item(user=user, subject_id="first")
            self.create_inbox_item(user=user, subject_id="second")
        self.create_inbox_item(organization=other_org)
        self.create_inbox_item(user=self.create_user(), status=ObjectStatus.PENDING_DELETION)
        with (
            patch("sentry.inbox.item_retention.SCHEDULE_BATCH_SIZE", 2),
            patch.object(cleanup_inbox_items, "delay") as enqueue,
            patch.object(schedule_organization_inbox_item_cleanup, "delay") as next_page,
        ):
            schedule_organization_inbox_item_cleanup(self.organization.id)
            assert enqueue.call_count == 2
            next_page.assert_called_once()
            schedule_organization_inbox_item_cleanup(
                *next_page.call_args.args, **next_page.call_args.kwargs
            )
        assert {
            (call.kwargs["organization_id"], call.kwargs["user_id"])
            for call in enqueue.call_args_list
        } == {(self.organization.id, user.id) for user in recipients}
        assert enqueue.call_count == 3
        next_page.assert_called_once_with(self.organization.id, after_user_id=recipients[1].id)

    def test_rollouts_are_independent(self) -> None:
        old = self.create_inbox_item(subject_id="old", last_activity_at=before_now(days=1))
        self.create_inbox_item(subject_id="recent")
        for _ in range(3):
            self.create_inbox_item_event(old)
        with (
            self.options(
                {"cleanup.inbox-items.enabled": False, "cleanup.inbox-events.enabled": True}
            ),
            patch("sentry.inbox.event_retention.MAX_EVENTS_PER_ITEM", 1),
            patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 1),
        ):
            cleanup_inbox_item_events(item_id=old.id)
            self._cleanup()
        old.refresh_from_db()
        assert old.status == ObjectStatus.ACTIVE
        assert old.events.count() == 1
        with patch.object(cleanup_inbox_items, "delay") as enqueue:
            schedule_organization_inbox_item_cleanup(self.organization.id)
        enqueue.assert_called_once_with(organization_id=self.organization.id, user_id=self.user.id)
        with patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 1):
            self._cleanup()
        old.refresh_from_db()
        assert old.status == ObjectStatus.PENDING_DELETION
        assert old.events.count() == 1

    def test_schedule_failure_rolls_back_pending_status(self) -> None:
        old = self.create_inbox_item(subject_id="old", last_activity_at=before_now(days=1))
        self.create_inbox_item(subject_id="recent")
        with (
            patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 1),
            patch.object(
                CellScheduledDeletion, "schedule", side_effect=RuntimeError("schedule failed")
            ),
            pytest.raises(RuntimeError, match="schedule failed"),
        ):
            cleanup_inbox_items(organization_id=self.organization.id, user_id=self.user.id)
        old.refresh_from_db()
        assert old.status == ObjectStatus.ACTIVE
        assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()

    def test_next_sweep_finds_new_overflow(self) -> None:
        old = self.create_inbox_item(subject_id="old", last_activity_at=before_now(days=1))
        self.create_inbox_item(subject_id="recent")
        with patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 2):
            self._cleanup()
            assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()
            self.create_inbox_item(subject_id="new")
            self._cleanup()
        assert InboxItem.objects.filter(status=ObjectStatus.ACTIVE).count() == 2
        assert CellScheduledDeletion.objects.filter(
            model_name="InboxItem", object_id=old.id
        ).exists()

    def test_under_limit_only_probes_capacity(self) -> None:
        self.create_inbox_item()
        with self.assertNumQueries(1), patch.object(cleanup_inbox_items, "delay") as enqueue:
            cleanup_inbox_items(organization_id=self.organization.id, user_id=self.user.id)
        enqueue.assert_not_called()
        assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()

    def test_candidate_reactivated_after_selection_is_preserved(self) -> None:
        old = self.create_inbox_item(subject_id="old", last_activity_at=before_now(days=1))
        self.create_inbox_item(subject_id="recent")
        queryset_type = type(InboxItem.objects.all())
        select_for_update = queryset_type.select_for_update

        def reactivate(queryset: Any, **kwargs: Any) -> Any:
            old.update(last_activity_at=before_now(days=-1))
            return select_for_update(queryset, **kwargs)

        with (
            patch.object(queryset_type, "select_for_update", autospec=True, side_effect=reactivate),
            patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 1),
        ):
            cleanup_inbox_items(organization_id=self.organization.id, user_id=self.user.id)

        assert InboxItem.objects.filter(id=old.id, status=ObjectStatus.ACTIVE).exists()
        assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()


class InboxItemRetentionConcurrencyTest(TransactionTestCase):
    def test_skip_item_being_recorded(self) -> None:
        old = self.create_inbox_item(subject_id="old", last_activity_at=before_now(days=1))
        event = self.create_inbox_item_event(old)
        recent = self.create_inbox_item(subject_id="recent")
        organization_id, user_id = self.organization.id, self.user.id

        def run_cleanup() -> None:
            try:
                cleanup_inbox_items(organization_id=organization_id, user_id=user_id)
            finally:
                connections.close_all()

        with (
            self.options({"cleanup.inbox-items.enabled": True}),
            patch("sentry.inbox.item_retention.MAX_ITEMS_PER_INBOX", 1),
        ):
            with (
                transaction.atomic(using=router.db_for_write(InboxItem)),
                ContextPropagatingThreadPoolExecutor(max_workers=1) as executor,
            ):
                list(InboxItem.objects.filter(id=old.id).select_for_update())
                executor.submit(run_cleanup).result(timeout=20)
                assert not CellScheduledDeletion.objects.filter(model_name="InboxItem").exists()
                assert InboxItem.objects.filter(id=recent.id, status=ObjectStatus.ACTIVE).exists()
            with BurstTaskRunner() as drain:
                cleanup_inbox_items(organization_id=organization_id, user_id=user_id)
                drain()
        old.refresh_from_db()
        assert old.status == ObjectStatus.PENDING_DELETION
        assert InboxItemEvent.objects.filter(id=event.id).exists()


@with_feature("organizations:universal-inbox-recording")
class RecordTest(TestCase):
    def test_user_actor_and_multiple_recipients(self) -> None:
        actor = self.create_user()
        other = self.create_user()

        with patch("sentry.inbox.types.metrics.incr") as incr:
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(
                    summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                ),
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
            assert event.type == "issue.user_mentioned"
            assert event.data == {"summary": "Mentioned you in a comment", "comment_id": 123}
        incr.assert_any_call(
            "inbox.events.recorded", amount=2, tags={"event_type": "issue.user_mentioned"}
        )

    def test_no_other_recipients(self) -> None:
        group = self.group
        for recipients in ([], [123, 123]):
            with self.assertNumQueries(0):
                ISSUE_USER_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(
                        summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                    ),
                    recipient_user_ids=recipients,
                    actor=InboxActor.user(123),
                )

    def test_query_count_for_multiple_recipients(self) -> None:
        group = self.group
        recipients = [self.user.id, *[self.create_user().id for _ in range(19)]]
        Organization.objects.get_from_cache(id=self.organization.id)

        for user_ids in ([recipients[0]], recipients, list(reversed(recipients))):
            with self.subTest(recipient_count=len(user_ids)), self.assertNumQueries(5):
                ISSUE_USER_MENTIONED.record(
                    subject=group,
                    data=IssueMentionedData(
                        summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                    ),
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
                    data=IssueMentionedData(
                        summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                    ),
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
                data=IssueMentionedData(
                    summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                ),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )
        with self.feature({"organizations:universal-inbox": False}):
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(
                    summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=456
                ),
                recipient_user_ids=[self.user.id],
                actor=SYSTEM_ACTOR,
            )

        assert InboxItem.objects.count() == 1
        assert list(InboxItemEvent.objects.order_by("id").values_list("data", flat=True)) == [
            {"summary": "Mentioned you in a comment", "comment_id": 123},
            {"summary": "Mentioned you in a comment", "comment_id": 456},
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
                data=IssueMentionedData(
                    summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                ),
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
            data=InboxEventData(summary=InboxEventSummary.ISSUE_USER_MENTIONED),
            recipient_user_ids=[self.user.id],
            actor=SYSTEM_ACTOR,
        )

        item = InboxItem.objects.get()
        assert item.organization_id == self.organization.id
        assert item.subject_type == "test.reference"
        assert item.subject_id == "period-1"
        assert item.events.get().data == {"summary": "Mentioned you in a comment"}

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
            ISSUE_USER_MENTIONED.record(
                subject=self.group,
                data=IssueMentionedData(
                    summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                ),
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
                data=IssueMentionedData(
                    summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                ),
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
                data=IssueMentionedData(
                    summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123
                ),
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
            data=IssueMentionedData(summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=123),
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
                    data=IssueMentionedData(
                        summary=InboxEventSummary.ISSUE_USER_MENTIONED, comment_id=comment_id
                    ),
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
