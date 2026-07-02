from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from sentry import options as real_options
from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.tasks.backfill_group_action_log import backfill_group_action_log_for_org
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType

TEST_BATCH_SIZE = 5


class BackfillGroupActionLogForOrgTest(TestCase):
    def setUp(self):
        super().setUp()
        self.event = self.store_event(
            data={"message": "test error", "level": "error"},
            project_id=self.project.id,
        )
        self.group = self.event.group

    def _options(self, killswitch=False, batch_size=TEST_BATCH_SIZE, delay=0):
        overrides = {
            "issues.backfill_group_action_log.killswitch": killswitch,
            "issues.backfill_group_action_log.batch_size": batch_size,
            "issues.backfill_group_action_log.inter_batch_delay_s": delay,
        }
        original_get = real_options.get

        def side_effect(key, *args, **kwargs):
            if key in overrides:
                return overrides[key]
            return original_get(key, *args, **kwargs)

        return patch("sentry.tasks.backfill_group_action_log.options.get", side_effect=side_effect)

    def _create_activity(self, activity_type, data=None, user_id=None, group=None, project=None):
        return Activity.objects.create(
            project=project or self.project,
            group=group or self.group,
            type=activity_type.value,
            user_id=user_id,
            data=data or {},
            datetime=datetime.now(UTC) - timedelta(days=1),
        )

    def test_converts_activities_to_action_log_entries(self):
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self._create_activity(
            ActivityType.ASSIGNED,
            data={"assignee": str(self.user.id), "assigneeType": "user"},
            user_id=self.user.id,
        )

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(self.organization.id)

        entries = GroupActionLogEntry.objects.filter(group_id=self.group.id).order_by("id")
        assert entries.count() == 2

        resolve_entry = entries[0]
        assert resolve_entry.type == GroupActionType.RESOLVE.value
        assert resolve_entry.actor_type == GroupActorType.USER.value
        assert resolve_entry.actor_id == self.user.id
        assert resolve_entry.source == "unknown"
        assert resolve_entry.idempotency_key.startswith("activity:")

        assign_entry = entries[1]
        assert assign_entry.type == GroupActionType.ASSIGN.value
        assert assign_entry.data["assignee_type"] == "user"

    def test_skips_activities_without_group(self):
        Activity.objects.create(
            project=self.project,
            group=None,
            type=ActivityType.DEPLOY.value,
            data={"deploy_id": 1, "version": "v1", "environment": "prod"},
            datetime=datetime.now(UTC),
        )

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(self.organization.id)

        assert GroupActionLogEntry.objects.filter(project_id=self.project.id).count() == 0

    def test_skips_first_seen(self):
        self._create_activity(ActivityType.FIRST_SEEN)

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(self.organization.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0

    def test_idempotent_rerun(self):
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(self.organization.id)
            backfill_group_action_log_for_org(self.organization.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_respects_killswitch(self):
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(killswitch=True):
            backfill_group_action_log_for_org(self.organization.id)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0

    def test_self_chains_between_batches(self):
        for _ in range(3):
            self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with (
            self._options(batch_size=2),
            patch.object(backfill_group_action_log_for_org, "apply_async") as mock_apply,
        ):
            backfill_group_action_log_for_org(self.organization.id)

        mock_apply.assert_called_once()
        call_kwargs = mock_apply.call_args.kwargs["kwargs"]
        assert call_kwargs["last_project_id"] == self.project.id
        assert call_kwargs["last_activity_id"] > 0

    def test_moves_to_next_project(self):
        project2 = self.create_project(organization=self.organization)
        event2 = self.store_event(
            data={"message": "test2", "level": "error"},
            project_id=project2.id,
        )
        group2 = event2.group

        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self._create_activity(
            ActivityType.SET_RESOLVED,
            user_id=self.user.id,
            group=group2,
            project=project2,
        )

        with (
            self._options(),
            patch.object(backfill_group_action_log_for_org, "apply_async") as mock_apply,
        ):
            backfill_group_action_log_for_org(self.organization.id)

        assert GroupActionLogEntry.objects.filter(project_id=self.project.id).count() == 1

        chain_kwargs = mock_apply.call_args.kwargs["kwargs"]
        assert chain_kwargs["last_project_id"] == self.project.id + 1
        assert chain_kwargs["last_activity_id"] == 0

    def test_completes_when_all_projects_exhausted(self):
        with (
            self._options(),
            patch.object(backfill_group_action_log_for_org, "apply_async") as mock_apply,
        ):
            backfill_group_action_log_for_org(
                self.organization.id,
                last_project_id=self.project.id + 1,
            )

        mock_apply.assert_not_called()

    def test_actor_mapping_user(self):
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(self.organization.id)

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.USER.value
        assert entry.actor_id == self.user.id

    def test_actor_mapping_system(self):
        self._create_activity(ActivityType.AUTO_SET_ONGOING, data={"after_days": 7})

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(self.organization.id)

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.SYSTEM.value
        assert entry.actor_id == 0

    def test_date_added_from_activity_datetime(self):
        activity = self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(self.organization.id)

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.date_added == activity.datetime

    def test_resumes_from_cursor(self):
        a1 = self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(
                self.organization.id,
                last_project_id=self.project.id,
                last_activity_id=a1.id,
            )

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1
        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.idempotency_key != f"activity:{a1.id}"

    def test_handles_validation_errors(self):
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)
        self._create_activity(ActivityType.SET_PRIORITY, data={})

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(self.organization.id)

        entries = GroupActionLogEntry.objects.filter(group_id=self.group.id)
        assert entries.count() == 1
        assert entries[0].type == GroupActionType.RESOLVE.value

    @patch("sentry.issues.derived.tasks.process_group_log_task.delay")
    def test_does_not_trigger_derived_processing(self, mock_derived_task):
        self._create_activity(ActivityType.SET_RESOLVED, user_id=self.user.id)

        with self._options(), patch.object(backfill_group_action_log_for_org, "apply_async"):
            backfill_group_action_log_for_org(self.organization.id)

        mock_derived_task.assert_not_called()
