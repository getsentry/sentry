from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import call as mock_call
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry import options as real_options
from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.options.project_option import ProjectOption
from sentry.tasks.backfill_group_action_log import (
    GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
    _reset_project,
    backfill_group_action_log_for_all_projects,
    backfill_group_action_log_for_group,
    backfill_group_action_log_for_project,
    enroll_organization_projects_for_group_action_log_backfill,
    enroll_projects_for_group_action_log_backfill,
    reset_and_backfill_group_action_log,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.types.activity import ActivityType

TEST_BATCH_SIZE = 5


class BackfillGroupActionLogForGroupTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.now = timezone.now()

    def test_backfills_activities_for_group(self) -> None:
        resolved_activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={},
            user_id=self.user.id,
            datetime=self.now - timedelta(minutes=2),
        )
        assigned_activity = self.create_group_activity(
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
        assert entries[0].date_added == resolved_activity.datetime
        assert entries[0].date_updated > entries[0].date_added
        assert entries[1].type == GroupActionType.ASSIGN.value
        assert entries[1].date_added == assigned_activity.datetime
        assert entries[1].date_updated > entries[1].date_added

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
        return Activity.objects.create_without_group_action(
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
        assert call_kwargs["cursor_datetime"] is not None
        assert call_kwargs["cursor_id"] > 0

    def test_self_chain_propagates_pr_lifecycle_handoff(self) -> None:
        for _ in range(3):
            self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with (
            self._options(batch_size=2),
            patch.object(backfill_group_action_log_for_project, "apply_async") as mock_apply,
        ):
            backfill_group_action_log_for_project(
                self.project.id,
                chain_pr_lifecycle=True,
            )

        call_kwargs = mock_apply.call_args.kwargs["kwargs"]
        assert call_kwargs["chain_pr_lifecycle"] is True

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
        a2 = self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(
                self.project.id,
                cursor_datetime=a1.datetime.isoformat(),
                cursor_id=a1.id,
            )

        entries = GroupActionLogEntry.objects.filter(group_id=self.group.id)
        assert entries.count() == 1
        assert entries[0].idempotency_key == f"activity:{a2.id}"

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

    def test_reset_deletes_backfilled_entries_before_backfill(self) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id, reset=True)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_reset_preserves_non_backfill_entries(self) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        GroupActionLogEntry.objects.create(
            group_id=self.group.id,
            project_id=self.project.id,
            type=GroupActionType.VIEW.value,
            actor_type=GroupActorType.USER.value,
            actor_id=self.user.id,
            source="web",
            data={},
        )
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 2

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id, reset=True)

        entries = GroupActionLogEntry.objects.filter(group_id=self.group.id)
        assert entries.count() == 2
        sources = {e.source for e in entries}
        assert "web" in sources
        assert "backfill:activity" in sources

    def test_reset_only_runs_on_first_batch(self) -> None:
        for _ in range(3):
            self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_project, "apply_async"):
            backfill_group_action_log_for_project(self.project.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 3

        with (
            self._options(),
            patch("sentry.tasks.backfill_group_action_log._reset_project") as mock_reset,
            patch.object(backfill_group_action_log_for_project, "apply_async"),
        ):
            backfill_group_action_log_for_project(
                self.project.id, reset=True, cursor_datetime="2020-01-01T00:00:00+00:00"
            )

        mock_reset.assert_not_called()

    @patch("sentry.issues.derived.tasks.generate_project_derived_data.delay")
    def test_triggers_derived_data_on_completion(self, mock_derived: Any) -> None:
        with self._options():
            backfill_group_action_log_for_project(self.project.id)

        mock_derived.assert_called_once_with(project_id=self.project.id)

    def test_sets_completion_option_on_empty_batch(self) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, False)

        with (
            self._options(batch_size=10),
            patch.object(backfill_group_action_log_for_project, "apply_async"),
        ):
            backfill_group_action_log_for_project(self.project.id)

        self.project.refresh_from_db()
        assert self.project.get_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION) is True

    def test_sets_completion_option_on_final_partial_batch(self) -> None:
        for _ in range(3):
            self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, False)

        with (
            self._options(batch_size=5),
            patch.object(backfill_group_action_log_for_project, "apply_async"),
        ):
            backfill_group_action_log_for_project(self.project.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 3
        self.project.refresh_from_db()
        assert self.project.get_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION) is True

    def test_does_not_set_completion_option_mid_chain(self) -> None:
        for _ in range(3):
            self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, False)

        with (
            self._options(batch_size=2),
            patch.object(backfill_group_action_log_for_project, "apply_async"),
        ):
            backfill_group_action_log_for_project(self.project.id)

        self.project.refresh_from_db()
        assert self.project.get_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION) is False

    def test_reset_marks_completion_option_incomplete(self) -> None:
        self.project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)

        _reset_project(self.project)

        self.project.refresh_from_db()
        assert self.project.get_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION) is False

    def test_missing_completion_option_is_not_created(self) -> None:
        with self._options():
            backfill_group_action_log_for_project(self.project.id)

        assert not ProjectOption.objects.filter(
            project=self.project, key=GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION
        ).exists()

    def test_chains_pr_lifecycle_instead_of_derived_data_on_completion(self) -> None:
        with (
            self._options(),
            patch(
                "sentry.tasks.backfill_pr_lifecycle_action_log."
                "backfill_pr_lifecycle_action_log_for_project.delay"
            ) as mock_pr_lifecycle,
            patch(
                "sentry.issues.derived.tasks.generate_project_derived_data.delay"
            ) as mock_derived,
        ):
            backfill_group_action_log_for_project(
                self.project.id,
                chain_pr_lifecycle=True,
            )

        mock_pr_lifecycle.assert_called_once_with(project_id=self.project.id)
        mock_derived.assert_not_called()

    def test_chains_pr_lifecycle_after_final_activity_batch(self) -> None:
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with (
            self._options(),
            patch(
                "sentry.tasks.backfill_pr_lifecycle_action_log."
                "backfill_pr_lifecycle_action_log_for_project.delay"
            ) as mock_pr_lifecycle,
            patch(
                "sentry.issues.derived.tasks.generate_project_derived_data.delay"
            ) as mock_derived,
        ):
            backfill_group_action_log_for_project(
                self.project.id,
                chain_pr_lifecycle=True,
            )

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1
        mock_pr_lifecycle.assert_called_once_with(project_id=self.project.id)
        mock_derived.assert_not_called()


class EnrollProjectsForGroupActionLogBackfillTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(
            override_options(
                {
                    "issues.backfill_group_action_log.enrollment_killswitch": False,
                    "issues.backfill_group_action_log.enrollment_organization_batch_size": 50,
                    "issues.backfill_group_action_log.enrollment_project_batch_size": 500,
                    "issues.backfill_group_action_log.enrollment_organization_inter_batch_delay_s": 0,
                    "issues.backfill_group_action_log.enrollment_project_inter_batch_delay_s": 0,
                }
            )
        )

    def _project_feature_results(self, enabled_project_ids: set[int]) -> Any:
        def has_feature(feature_name: str, project: Any) -> bool:
            assert feature_name == "projects:issue-action-log-write-to-db"
            return project.id in enabled_project_ids

        return patch(
            "sentry.tasks.backfill_group_action_log.features.has",
            side_effect=has_feature,
        )

    def test_dispatches_enrollment_for_active_organizations(self) -> None:
        first_organization = self.create_organization()
        second_organization = self.create_organization()
        inactive_organization = self.create_organization(status=1)

        with patch.object(
            enroll_organization_projects_for_group_action_log_backfill, "apply_async"
        ) as mock_apply:
            enroll_projects_for_group_action_log_backfill()

        dispatched_organization_ids = {
            call.kwargs["kwargs"]["organization_id"] for call in mock_apply.call_args_list
        }
        assert dispatched_organization_ids == {first_organization.id, second_organization.id}
        assert inactive_organization.id not in dispatched_organization_ids

    def test_enrolls_active_projects_without_overwriting_existing_option(self) -> None:
        organization = self.create_organization()
        pending_project = self.create_project(organization=organization)
        ineligible_project = self.create_project(organization=organization)
        completed_project = self.create_project(organization=organization)
        inactive_project = self.create_project(organization=organization)
        completed_project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, True)
        inactive_project.update(status=1)
        assert pending_project.get_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION) is None

        with self._project_feature_results({pending_project.id, completed_project.id}) as mock_has:
            enroll_organization_projects_for_group_action_log_backfill(organization.id)

        assert mock_has.call_args_list == [
            mock_call("projects:issue-action-log-write-to-db", pending_project),
            mock_call("projects:issue-action-log-write-to-db", ineligible_project),
            mock_call("projects:issue-action-log-write-to-db", completed_project),
        ]
        assert pending_project.get_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION) is False
        assert completed_project.get_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION) is True
        assert not ProjectOption.objects.filter(
            project=ineligible_project,
            key=GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
        ).exists()
        assert not ProjectOption.objects.filter(
            project=inactive_project,
            key=GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION,
        ).exists()

    def test_organization_coordinator_self_chains(self) -> None:
        self.create_organization()
        self.create_organization()

        with (
            override_options(
                {"issues.backfill_group_action_log.enrollment_organization_batch_size": 2}
            ),
            patch.object(
                enroll_projects_for_group_action_log_backfill, "apply_async"
            ) as mock_apply,
        ):
            enroll_projects_for_group_action_log_backfill()

        mock_apply.assert_called_once()
        assert mock_apply.call_args.kwargs["kwargs"]["last_organization_id"] > 0

    def test_project_enrollment_self_chains(self) -> None:
        organization = self.create_organization()
        for _ in range(3):
            self.create_project(organization=organization)

        with (
            override_options({"issues.backfill_group_action_log.enrollment_project_batch_size": 2}),
            patch.object(
                enroll_organization_projects_for_group_action_log_backfill, "apply_async"
            ) as mock_apply,
            self._project_feature_results(set()),
        ):
            enroll_organization_projects_for_group_action_log_backfill(organization.id)

        mock_apply.assert_called_once()
        assert mock_apply.call_args.kwargs["kwargs"]["organization_id"] == organization.id
        assert mock_apply.call_args.kwargs["kwargs"]["last_project_id"] > 0


class BackfillGroupActionLogForAllProjectsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(
            override_options(
                {
                    "issues.backfill_group_action_log.coordinator_killswitch": False,
                    "issues.backfill_group_action_log.coordinator_batch_size": 50,
                    "issues.backfill_group_action_log.coordinator_inter_batch_delay_s": 0,
                }
            )
        )

    def _set_backfill_complete(self, project: Any, value: bool) -> ProjectOption:
        project.update_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION, value)
        return ProjectOption.objects.get(
            project=project, key=GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION
        )

    def test_dispatches_only_explicitly_incomplete_project_options(self) -> None:
        incomplete_project = self.create_project(organization=self.organization)
        complete_project = self.create_project(organization=self.organization)
        project_without_option = self.create_project(organization=self.organization)
        inactive_project = self.create_project(organization=self.organization)
        self._set_backfill_complete(incomplete_project, False)
        self._set_backfill_complete(complete_project, True)
        self._set_backfill_complete(inactive_project, False)
        inactive_project.update(status=1)

        with (
            patch.object(backfill_group_action_log_for_project, "apply_async") as mock_apply,
            patch.object(
                backfill_group_action_log_for_all_projects, "apply_async"
            ) as mock_coordinator_apply,
        ):
            backfill_group_action_log_for_all_projects()

        dispatched_project_ids = {
            call.kwargs["kwargs"]["project_id"] for call in mock_apply.call_args_list
        }
        assert dispatched_project_ids == {incomplete_project.id, inactive_project.id}
        assert project_without_option.get_option(GROUP_ACTION_LOG_BACKFILL_COMPLETED_OPTION) is None
        mock_coordinator_apply.assert_not_called()

    def test_complete_options_still_advance_cursor(self) -> None:
        complete_project_1 = self.create_project(organization=self.organization)
        complete_project_2 = self.create_project(organization=self.organization)
        incomplete_project = self.create_project(organization=self.organization)
        self._set_backfill_complete(complete_project_1, True)
        complete_option_2 = self._set_backfill_complete(complete_project_2, True)
        self._set_backfill_complete(incomplete_project, False)

        with (
            override_options({"issues.backfill_group_action_log.coordinator_batch_size": 2}),
            patch.object(
                backfill_group_action_log_for_project, "apply_async"
            ) as mock_project_apply,
            patch.object(
                backfill_group_action_log_for_all_projects, "apply_async"
            ) as mock_coordinator_apply,
        ):
            backfill_group_action_log_for_all_projects()

        mock_project_apply.assert_not_called()
        assert mock_coordinator_apply.call_args.kwargs["kwargs"]["last_project_option_id"] == (
            complete_option_2.id
        )

    def test_logs_coordinator_phases(self) -> None:
        project = self.create_project(organization=self.organization)
        self._set_backfill_complete(project, False)

        with (
            self.assertLogs("sentry.tasks.backfill_group_action_log", level="INFO") as logs,
            patch.object(backfill_group_action_log_for_project, "apply_async"),
        ):
            backfill_group_action_log_for_all_projects()

        events = [record.getMessage() for record in logs.records]
        assert events == [
            "backfill_group_action_log.coordinator.started",
            "backfill_group_action_log.coordinator.query_started",
            "backfill_group_action_log.coordinator.query_completed",
            "backfill_group_action_log.coordinator.dispatch_started",
            "backfill_group_action_log.coordinator.batch_dispatched",
            "backfill_group_action_log.coordinator.completed",
        ]
        query_completed = logs.records[2]
        assert query_completed.__dict__["duration_ms"] >= 0
        assert query_completed.__dict__["incomplete_option_count"] == 1
        assert query_completed.__dict__["option_count"] == 1

    def test_self_chains_when_more_projects_remain(self) -> None:
        for _ in range(3):
            project = self.create_project(organization=self.organization)
            self._set_backfill_complete(project, False)

        with (
            override_options({"issues.backfill_group_action_log.coordinator_batch_size": 2}),
            patch.object(
                backfill_group_action_log_for_project, "apply_async"
            ) as mock_project_apply,
            patch.object(
                backfill_group_action_log_for_all_projects, "apply_async"
            ) as mock_coordinator_apply,
        ):
            backfill_group_action_log_for_all_projects(project_reset=True)

        mock_coordinator_apply.assert_called_once()
        for call in mock_project_apply.call_args_list:
            assert call.kwargs["kwargs"]["reset"] is True
        coordinator_kwargs = mock_coordinator_apply.call_args.kwargs["kwargs"]
        assert coordinator_kwargs["project_reset"] is True
        assert "last_project_option_id" in coordinator_kwargs

    def test_project_option_cursor_resumes_from_last_position(self) -> None:
        p1 = self.create_project(organization=self.organization)
        p2 = self.create_project(organization=self.organization)
        option1 = self._set_backfill_complete(p1, False)
        self._set_backfill_complete(p2, False)

        with (
            patch.object(backfill_group_action_log_for_project, "apply_async") as mock_apply,
            patch.object(backfill_group_action_log_for_all_projects, "apply_async"),
        ):
            backfill_group_action_log_for_all_projects(last_project_option_id=option1.id)

        dispatched_project_ids = {
            call.kwargs["kwargs"]["project_id"] for call in mock_apply.call_args_list
        }
        assert p1.id not in dispatched_project_ids
        assert p2.id in dispatched_project_ids
