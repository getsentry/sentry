from datetime import datetime
from unittest.mock import patch

from sentry.issues.attributes import (
    GroupValues,
    Operation,
    _retrieve_group_values,
    _retrieve_snapshot_values,
)
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


@region_silo_test
class PostSaveLogGroupAttributesChangedTest(TestCase):
    def test(self):
        self.run_attr_test(self.group, [], "all")
        self.run_attr_test(self.group, ["status"], "status")
        self.run_attr_test(self.group, ["status", "last_seen"], "status")
        self.run_attr_test(self.group, ["status", "substatus"], "status-substatus")

    def run_attr_test(self, group, update_fields, expected_str):
        with patch(
            "sentry.issues.attributes._log_group_attributes_changed"
        ) as _log_group_attributes_changed, patch(
            "sentry.issues.attributes.send_snapshot_values"
        ) as send_snapshot_values:
            kwargs = {}
            if update_fields:
                kwargs["update_fields"] = update_fields
            self.group.save(**kwargs)
            _log_group_attributes_changed.assert_called_with(
                Operation.UPDATED, "group", expected_str
            )
            send_snapshot_values.assert_called_with(None, group, False)

    def test_new(self):
        with patch(
            "sentry.issues.attributes._log_group_attributes_changed"
        ) as _log_group_attributes_changed, patch(
            "sentry.issues.attributes.send_snapshot_values"
        ) as send_snapshot_values:
            new_group = self.create_group(self.project)
            _log_group_attributes_changed.assert_called_with(Operation.CREATED, "group", None)

            send_snapshot_values.assert_called_with(None, new_group, False)

    def test_update(self):
        with patch(
            "sentry.issues.attributes._log_group_attributes_changed"
        ) as _log_group_attributes_changed, patch(
            "sentry.issues.attributes.send_snapshot_values"
        ) as send_snapshot_values:
            self.group.update(status=2)
            _log_group_attributes_changed.assert_called_with(Operation.UPDATED, "group", "status")
            send_snapshot_values.assert_called_with(None, self.group, False)
