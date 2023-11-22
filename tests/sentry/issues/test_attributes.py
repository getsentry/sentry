from datetime import datetime

from sentry.issues.attributes import GroupValues, _retrieve_group_values, _retrieve_snapshot_values
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupAttributesTest(TestCase):
    def test_retrieve_group_values(self) -> None:
        group = self.create_group()
        assert _retrieve_group_values(group.id) == GroupValues(
            id=group.id,
            project_id=group.project_id,
            status=group.status,
            substatus=group.substatus,
            first_seen=group.first_seen,
            num_comments=group.num_comments,
        )

    def test_retrieve_snapshot_values_group_owner(self) -> None:
        group = self.create_group()
        GroupOwner.objects.create(
            group=group,
            project=group.project,
            organization=group.project.organization,
            type=GroupOwnerType.SUSPECT_COMMIT.value,
            user_id=self.user.id,
        )
        GroupOwner.objects.create(
            group=group,
            project=group.project,
            organization=group.project.organization,
            type=GroupOwnerType.OWNERSHIP_RULE.value,
            user_id=self.user.id,
        )
        GroupOwner.objects.create(
            group=group,
            project=group.project,
            organization=group.project.organization,
            type=GroupOwnerType.CODEOWNERS.value,
            user_id=self.user.id,
        )
        GroupAssignee.objects.create(
            group=group,
            project=group.project,
            user_id=self.user.id,
            date_added=datetime.now(),
        )

        assert (
            _retrieve_snapshot_values(group, False).items()
            >= {
                "group_deleted": False,
                "project_id": group.project_id,
                "group_id": group.id,
                "status": group.status,
                "substatus": group.substatus,
                "first_seen": group.first_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                "num_comments": group.num_comments,
                "assignee_user_id": self.user.id,
                "assignee_team_id": None,
                "owner_suspect_commit_user_id": self.user.id,
                "owner_ownership_rule_user_id": self.user.id,
                "owner_ownership_rule_team_id": None,
                "owner_codeowners_user_id": self.user.id,
                "owner_codeowners_team_id": None,
            }.items()
        )
