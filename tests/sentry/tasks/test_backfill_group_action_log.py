from __future__ import annotations

from datetime import timedelta
from typing import Any
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.tasks.backfill_group_action_log import (
    backfill_group_action_log_for_group,
    reset_and_backfill_group_action_log,
)
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


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
