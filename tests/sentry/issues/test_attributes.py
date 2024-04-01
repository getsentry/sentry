from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from sentry_sdk import Hub
from snuba_sdk.legacy import json_to_snql

from sentry.issues.attributes import (
    GroupValues,
    Operation,
    _bulk_retrieve_group_values,
    _bulk_retrieve_snapshot_values,
    _retrieve_group_values,
)
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.types.group import GroupSubStatus
from sentry.utils import json
from sentry.utils.snuba import _snql_query


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

    def test_bulk_retrieve_group_values(self) -> None:
        group = self.create_group()
        group_2 = self.create_group(
            status=GroupStatus.RESOLVED,
            substatus=GroupSubStatus.ESCALATING,
            first_seen=timezone.now() - timedelta(days=5),
            num_comments=50,
        )
        assert _bulk_retrieve_group_values([group.id, group_2.id]) == [
            GroupValues(
                id=group.id,
                project_id=group.project_id,
                status=group.status,
                substatus=group.substatus,
                first_seen=group.first_seen,
                num_comments=group.num_comments,
            ),
            GroupValues(
                id=group_2.id,
                project_id=group_2.project_id,
                status=group_2.status,
                substatus=group_2.substatus,
                first_seen=group_2.first_seen,
                num_comments=group_2.num_comments,
            ),
        ]

    def test_bulk_retrieve_snapshot_values_group_owner(self) -> None:
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
            date_added=timezone.now(),
        )
        group_2 = self.create_group()
        GroupAssignee.objects.create(
            group=group_2,
            project=group.project,
            team_id=self.team.id,
            date_added=timezone.now(),
        )

        snapshot_values = _bulk_retrieve_snapshot_values([group, group_2], False)
        for g, sv in zip([group, group_2], snapshot_values):
            assert "timestamp" in sv
            del sv["timestamp"]  # type: ignore[misc]

        assert snapshot_values == [
            {
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
            },
            {
                "group_deleted": False,
                "project_id": group_2.project_id,
                "group_id": group_2.id,
                "status": group_2.status,
                "substatus": group_2.substatus,
                "first_seen": group_2.first_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                "num_comments": group_2.num_comments,
                "assignee_user_id": None,
                "assignee_team_id": self.team.id,
                "owner_suspect_commit_user_id": None,
                "owner_ownership_rule_user_id": None,
                "owner_ownership_rule_team_id": None,
                "owner_codeowners_user_id": None,
                "owner_codeowners_team_id": None,
            },
        ]


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

    def test_model_update(self):
        with patch(
            "sentry.issues.attributes._log_group_attributes_changed"
        ) as _log_group_attributes_changed, patch(
            "sentry.issues.attributes.send_snapshot_values"
        ) as send_snapshot_values:
            self.group.update(status=2)
            _log_group_attributes_changed.assert_called_with(Operation.UPDATED, "group", "status")
            send_snapshot_values.assert_called_with(None, self.group, False)


class PostUpdateLogGroupAttributesChangedTest(TestCase):
    def setUp(self):
        super().setUp()
        self.group_2 = self.create_group()

    def test(self):
        self.run_attr_test([self.group, self.group_2], {"status": GroupStatus.RESOLVED}, "status")
        self.run_attr_test(
            [self.group, self.group_2],
            {"status": GroupStatus.RESOLVED, "substatus": GroupSubStatus.ONGOING},
            "status-substatus",
        )

    def run_attr_test(self, groups, update_fields, expected_str):
        groups.sort(key=lambda g: g.id)
        with patch(
            "sentry.issues.attributes._log_group_attributes_changed"
        ) as _log_group_attributes_changed:
            with override_options(
                {
                    "groups.enable-post-update-signal": True,
                    "issues.group_attributes.send_kafka": True,
                }
            ):
                Group.objects.filter(id__in=[g.id for g in groups]).update(**update_fields)
            _log_group_attributes_changed.assert_called_with(
                Operation.UPDATED, "group", expected_str
            )
            snuba_fields = {f"group_{k}": v for k, v in update_fields.items()}
            json_body = {
                "selected_columns": [
                    "project_id",
                    "group_id",
                    *snuba_fields.keys(),
                ],
                "offset": 0,
                "limit": 100,
                "project": [groups[0].project_id],
                "dataset": "group_attributes",
                "conditions": [
                    ["project_id", "IN", [groups[0].project_id]],
                ],
                "order_by": ["group_id"],
                "consistent": True,
                "tenant_ids": {
                    "referrer": "group_attributes",
                    "organization_id": groups[0].project.organization_id,
                },
            }
            request = json_to_snql(json_body, "group_attributes")
            request.validate()
            identity = lambda x: x
            resp = _snql_query(((request, identity, identity), Hub(Hub.current), {}, "test_api"))
            assert resp[0].status == 200
            stuff = json.loads(resp[0].data)
            assert stuff["data"] == [
                {"project_id": g.project_id, "group_id": g.id, **snuba_fields} for g in groups
            ]
