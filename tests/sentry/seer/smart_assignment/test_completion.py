from typing import Any

from django.utils import timezone

from sentry.models.activity import Activity, ActivityIntegration
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.projectownership import ProjectOwnership
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunType
from sentry.seer.smart_assignment.completion import process_smart_assignment_completion
from sentry.seer.smart_assignment.models import SEER_FEATURE_ID
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.users.models.user import User

AUTO_ASSIGN_FLAG = "organizations:seer-smart-assignment-assign"


class ProcessSmartAssignmentCompletionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.seer_run = SeerRun.objects.create(
            organization=self.organization,
            type=SeerRunType.FEATURE_RUN,
            last_triggered_at=timezone.now(),
        )
        self.mirror = SeerAgentRun.objects.create(
            run=self.seer_run,
            source=SEER_FEATURE_ID,
            group=self.group,
            extras={"trigger": ActivityType.SEER_RCA_STARTED.name},
        )

    def _activity(self, predicted_assignee_user_ids: list[int | None]) -> Activity:
        return Activity.objects.create_without_group_action(
            project_id=self.group.project_id,
            group=self.group,
            type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value,
            data={
                "run_id": self.seer_run.id,
                "run_uuid": str(self.seer_run.uuid),
                "predicted_assignee_user_ids": predicted_assignee_user_ids,
            },
        )

    def _extras(self) -> dict[str, Any]:
        self.mirror.refresh_from_db()
        return self.mirror.extras

    def _member(self, username: str = "alice") -> User:
        user = self.create_user(username=username)
        self.create_member(user=user, organization=self.organization)
        return user

    def _set_project_auto_assignment(self, enabled: bool) -> None:
        # The post_save signal keeps get_ownership_cached in sync with this row.
        ProjectOwnership.objects.create(
            project_id=self.group.project_id,
            auto_assignment=enabled,
            suspect_committer_auto_assignment=False,
        )

    def _suggested_owners(self) -> list[GroupOwner]:
        return list(
            GroupOwner.objects.filter(group=self.group, type=GroupOwnerType.SEER_SUGGESTED.value)
        )

    def test_records_prediction_regardless_of_flag(self) -> None:
        # Scoring bookkeeping is internal, not user-facing, so it runs without the flag.
        alice = self._member()
        process_smart_assignment_completion(self.group, self._activity([alice.id]))

        assert self._extras()["predicted_assignee_user_ids"] == [alice.id]

    def test_handles_missing_payload(self) -> None:
        # Defensive: run_id is always set by delivery, but a payload missing the picks
        # still records an (empty) prediction on the run rather than raising.
        activity = Activity.objects.create_without_group_action(
            project_id=self.group.project_id,
            group=self.group,
            type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value,
            data={"run_id": self.seer_run.id},
        )
        process_smart_assignment_completion(self.group, activity)
        assert self._extras()["predicted_assignee_user_ids"] == []

    def test_no_writes_without_flag(self) -> None:
        alice = self._member()
        process_smart_assignment_completion(self.group, self._activity([alice.id]))

        # Everything user-facing is behind the flag: no suggested owner, no assignment.
        assert self._suggested_owners() == []
        assert not GroupAssignee.objects.filter(group=self.group).exists()

    def test_suggests_without_assigning_when_project_auto_assign_off(self) -> None:
        alice = self._member()
        self._set_project_auto_assignment(False)
        with self.feature(AUTO_ASSIGN_FLAG):
            process_smart_assignment_completion(self.group, self._activity([alice.id, None]))

        owners = self._suggested_owners()
        assert len(owners) == 1
        assert owners[0].user_id == alice.id
        assert owners[0].context == {"run_uuid": str(self.seer_run.uuid)}
        # Project doesn't auto-assign to owners -> the pick stays a suggestion.
        assert not GroupAssignee.objects.filter(group=self.group).exists()

    def test_promotes_suggestion_to_assignment_when_project_auto_assigns(self) -> None:
        alice = self._member()
        self._set_project_auto_assignment(True)
        with self.feature(AUTO_ASSIGN_FLAG):
            process_smart_assignment_completion(self.group, self._activity([alice.id]))

        # Suggested owner is always written...
        assert len(self._suggested_owners()) == 1
        # ...and promoted to a real assignment via the existing auto-assign machinery.
        assignee = GroupAssignee.objects.get(group=self.group)
        assert assignee.user_id == alice.id
        # The ASSIGNED activity is tagged so ground-truth capture skips our own work.
        assigned = Activity.objects.filter(
            group=self.group, type=ActivityType.ASSIGNED.value
        ).latest("datetime")
        assert assigned.data["integration"] == ActivityIntegration.SEER_SUGGESTED.value

    def test_does_not_override_existing_assignee(self) -> None:
        existing = self.create_user()
        alice = self._member()
        GroupAssignee.objects.assign(self.group, existing)
        self._set_project_auto_assignment(True)
        with self.feature(AUTO_ASSIGN_FLAG):
            process_smart_assignment_completion(self.group, self._activity([alice.id]))

        # We record the suggestion but never override a manual assignment.
        assert len(self._suggested_owners()) == 1
        assert GroupAssignee.objects.get(group=self.group).user_id == existing.id

    def test_no_writes_when_top_pick_unlinked(self) -> None:
        with self.feature(AUTO_ASSIGN_FLAG):
            process_smart_assignment_completion(self.group, self._activity([None]))

        assert self._suggested_owners() == []
        assert not GroupAssignee.objects.filter(group=self.group).exists()

    def test_no_writes_on_abstain(self) -> None:
        with self.feature(AUTO_ASSIGN_FLAG):
            process_smart_assignment_completion(self.group, self._activity([]))

        assert self._suggested_owners() == []
        assert not GroupAssignee.objects.filter(group=self.group).exists()

    def test_suggested_owner_is_idempotent(self) -> None:
        alice = self._member()
        self._set_project_auto_assignment(False)
        with self.feature(AUTO_ASSIGN_FLAG):
            process_smart_assignment_completion(self.group, self._activity([alice.id]))
            process_smart_assignment_completion(self.group, self._activity([alice.id]))

        assert len(self._suggested_owners()) == 1
