from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry import options as real_options
from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.tasks.backfill_group_action_log import (
    backfill_group_action_log_for_group,
    backfill_group_action_log_for_project,
    reset_and_backfill_group_action_log,
)
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType

TEST_BATCH_SIZE = 5


class BackfillGroupActionLogForGroupTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.now = timezone.now()

    def test_backfills_activities_for_group(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            user_id=self.user.id,
            datetime=self.now - timedelta(minutes=2),
        )
        self.create_group_activity(
            group=self.group,
            type=ActivityType.ASSIGNED.value,
            data={"assignee": str(self.user.id), "assigneeType": "user"},
            user_id=self.user.id,
            datetime=self.now - timedelta(minutes=1),
        )

        backfill_group_action_log_for_group(self.group.id)

        entries = GroupActionLogEntry.objects.filter(group_id=self.group.id).order_by("date_added")
        assert entries.count() == 2
        assert entries[0].type == GroupActionType.RESOLVE.value
        assert entries[1].type == GroupActionType.ASSIGN.value

    def test_sets_actor_from_user_id(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            user_id=self.user.id,
        )

        backfill_group_action_log_for_group(self.group.id)

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.USER.value
        assert entry.actor_id == self.user.id

    def test_sets_system_actor_when_no_user(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.AUTO_SET_ONGOING.value,
            data={},
        )

        backfill_group_action_log_for_group(self.group.id)

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.SYSTEM.value
        assert entry.actor_id == 0

    def test_noop_for_nonexistent_group(self) -> None:
        backfill_group_action_log_for_group(999999999)

        assert GroupActionLogEntry.objects.count() == 0

    def test_idempotent_rerun(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            user_id=self.user.id,
        )

        backfill_group_action_log_for_group(self.group.id)
        backfill_group_action_log_for_group(self.group.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_does_not_affect_other_groups(self) -> None:
        other_group = self.create_group()
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )
        self.create_group_activity(
            group=other_group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )

        backfill_group_action_log_for_group(self.group.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1
        assert GroupActionLogEntry.objects.filter(group_id=other_group.id).count() == 0

    def test_preserves_activity_datetime(self) -> None:
        ts = self.now - timedelta(days=30)
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            datetime=ts,
        )

        backfill_group_action_log_for_group(self.group.id)

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.date_added == ts

    @patch("sentry.issues.action_log.backfill.backfill_group_activities")
    def test_logs_and_reraises_on_failure(self, mock_backfill: Any) -> None:
        mock_backfill.side_effect = RuntimeError("boom")

        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
        )

        with pytest.raises(RuntimeError):
            backfill_group_action_log_for_group(self.group.id)


class ResetAndBackfillGroupActionLogTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.now = timezone.now()

    def _backfill_group(self) -> None:
        self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            user_id=self.user.id,
            datetime=self.now - timedelta(minutes=1),
        )
        backfill_group_action_log_for_group(self.group.id)

    def test_deletes_backfilled_entries_and_retriggers(self) -> None:
        self._backfill_group()
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

        with patch.object(backfill_group_action_log_for_group, "delay") as mock_delay:
            reset_and_backfill_group_action_log(self.group.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0
        mock_delay.assert_called_once_with(group_id=self.group.id)

    def test_preserves_non_backfill_entries(self) -> None:
        self._backfill_group()

        GroupActionLogEntry.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            type=GroupActionType.VIEW.value,
            actor_type=GroupActorType.USER.value,
            actor_id=self.user.id,
            source="web",
            data={},
        )
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 2

        with patch.object(backfill_group_action_log_for_group, "delay"):
            reset_and_backfill_group_action_log(self.group.id)

        remaining = GroupActionLogEntry.objects.filter(group_id=self.group.id)
        assert remaining.count() == 1
        assert remaining[0].source == "web"

    def test_noop_for_nonexistent_group(self) -> None:
        with patch.object(backfill_group_action_log_for_group, "delay") as mock_delay:
            reset_and_backfill_group_action_log(999999999)

        mock_delay.assert_not_called()


class BackfillGroupActionLogForProjectTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.event = self.store_event(
            data={"message": "test error", "level": "error"},
            project_id=self.project.id,
        )
        self.group = self.event.group

    def _options(
        self,
        killswitch: bool = False,
        batch_size: int = TEST_BATCH_SIZE,
        delay: int = 0,
    ) -> Any:
        overrides = {
            "issues.backfill_group_action_log.killswitch": killswitch,
            "issues.backfill_group_action_log.batch_size": batch_size,
            "issues.backfill_group_action_log.inter_batch_delay_s": delay,
        }
        original_get = real_options.get

        def side_effect(key: str, *args: Any, **kwargs: Any) -> Any:
            if key in overrides:
                return overrides[key]
            return original_get(key, *args, **kwargs)

        return patch("sentry.tasks.backfill_group_action_log.options.get", side_effect=side_effect)

    def _create_activity(
        self,
        activity_type: ActivityType,
        data: dict[str, Any] | None = None,
        user_id: int | None = None,
        group: Group | None = None,
    ) -> Activity:
        return Activity.objects.create(
            project=self.project,
            group=group or self.group,
            type=activity_type.value,
            user_id=user_id,
            data=data or {},
            datetime=datetime.now(UTC) - timedelta(days=1),
        )

    def test_converts_activities_to_action_log_entries(self) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self._create_activity(
            ActivityType.ASSIGNED,
            data={"assignee": str(self.user.id), "assigneeType": "user"},
            user_id=self.user.id,
        )

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        entries = GroupActionLogEntry.objects.filter(group_id=self.group.id).order_by("id")
        assert entries.count() == 2

        resolve_entry = entries[0]
        assert resolve_entry.type == GroupActionType.RESOLVE.value
        assert resolve_entry.actor_type == GroupActorType.USER.value
        assert resolve_entry.actor_id == self.user.id
        assert resolve_entry.source == "backfill:activity"
        assert resolve_entry.idempotency_key is not None
        assert resolve_entry.idempotency_key.startswith("activity:")

        assign_entry = entries[1]
        assert assign_entry.type == GroupActionType.ASSIGN.value
        assert assign_entry.data["assignee_type"] == "user"

    def test_skips_activities_without_group(self) -> None:
        Activity.objects.create(
            project=self.project,
            group=None,
            type=ActivityType.DEPLOY.value,
            data={"deploy_id": 1, "version": "v1", "environment": "prod"},
            datetime=datetime.now(UTC),
        )

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        assert GroupActionLogEntry.objects.filter(project_id=self.project.id).count() == 0

    def test_skips_first_seen(self) -> None:
        self._create_activity(ActivityType.FIRST_SEEN)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0

    def test_idempotent_rerun(self) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)
            backfill_group_action_log_for_project(self.project.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_respects_killswitch(self) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(killswitch=True):
            backfill_group_action_log_for_project(self.project.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0

    def test_self_chains_between_batches(self) -> None:
        for _ in range(3):
            self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with (
            self._options(batch_size=2),
            patch.object(backfill_group_action_log_for_project, "apply_async") as mock_apply,
        ):
            backfill_group_action_log_for_project(self.project.id)

        mock_apply.assert_called_once()
        call_kwargs = mock_apply.call_args.kwargs["kwargs"]
        assert call_kwargs["project_id"] == self.project.id
        assert call_kwargs["last_activity_id"] > 0

    def test_completes_when_no_activities(self) -> None:
        with (
            self._options(),
            patch.object(backfill_group_action_log_for_project, "apply_async") as mock_apply,
        ):
            backfill_group_action_log_for_project(self.project.id)

        mock_apply.assert_not_called()

    def test_actor_mapping_user(self) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.USER.value
        assert entry.actor_id == self.user.id

    def test_actor_mapping_system(self) -> None:
        self._create_activity(ActivityType.AUTO_SET_ONGOING, data={"after_days": 7})

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.SYSTEM.value
        assert entry.actor_id == 0

    def test_date_added_from_activity_datetime(self) -> None:
        activity = self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.date_added == activity.datetime

    def test_resumes_from_cursor(self) -> None:
        a1 = self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(
                self.project.id,
                last_activity_id=a1.id,
            )

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.idempotency_key != f"activity:{a1.id}"

    def test_handles_validation_errors(self) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self._create_activity(ActivityType.SET_PRIORITY, data={})

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        entries = GroupActionLogEntry.objects.filter(group_id=self.group.id)
        assert entries.count() == 1
        assert entries[0].type == GroupActionType.RESOLVE.value

    @patch("sentry.issues.derived.tasks.process_group_log_task.delay")
    def test_does_not_trigger_derived_processing(self, mock_derived_task: Any) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        mock_derived_task.assert_not_called()
