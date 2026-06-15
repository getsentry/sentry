from typing import Any, Mapping

import pytest
from jsonschema import ValidationError

from sentry.models.groupassignee import GroupAssignee
from sentry.rules.filters.assigned_to import AssignedToFilter
from sentry.workflow_engine.handlers.condition.assigned_to_handler import AssignedToConditionHandler
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestAssignedToCondition(ConditionTestCase):
    condition = Condition.ASSIGNED_TO
    payload: Mapping[str, Any] = {
        "id": AssignedToFilter.id,
        "targetType": "Member",
        "targetIdentifier": 0,
    }

    def setUp(self) -> None:
        super().setUp()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group_event.group)
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "target_type": "Member",
                "target_identifier": 0,
            },
            condition_result=True,
        )

    def test_dual_write(self) -> None:
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "target_type": "Member",
            "target_identifier": 0,
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

        payload = {
            "id": AssignedToFilter.id,
            "targetType": "Unassigned",
        }
        dc = self.translate_to_data_condition(payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "target_type": "Unassigned",
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_json_schema(self) -> None:
        self.dc.comparison.update({"target_type": "Team"})
        self.dc.save()

        self.dc.comparison.update({"target_type": "asdf"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"target_identifier": False})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"hello": "there"})
        with pytest.raises(ValidationError):
            self.dc.save()

        self.dc.comparison.update({"target_type": "Unassigned", "target_identifier": 0})
        with pytest.raises(ValidationError):
            self.dc.save()

    def test_assigned_to_member_passes(self) -> None:
        GroupAssignee.objects.create(user_id=self.user.id, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Member", "target_identifier": self.user.id})
        self.assert_passes(self.dc, self.event_data)

    def test_assigned_to_member_fails(self) -> None:
        user = self.create_user()
        GroupAssignee.objects.create(user_id=user.id, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Member", "target_identifier": self.user.id})
        self.assert_does_not_pass(self.dc, self.event_data)

    def test_assigned_to_team_passes(self) -> None:
        GroupAssignee.objects.create(team=self.team, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Team", "target_identifier": self.team.id})
        self.assert_passes(self.dc, self.event_data)

    def test_assigned_to_team_fails(self) -> None:
        team = self.create_team(self.organization)
        GroupAssignee.objects.create(team=team, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Team", "target_identifier": self.team.id})
        self.assert_does_not_pass(self.dc, self.event_data)

    def test_assigned_to_no_one_passes(self) -> None:
        self.dc.update(comparison={"target_type": "Unassigned"})
        self.assert_passes(self.dc, self.event_data)

    def test_assigned_to_no_one_fails(self) -> None:
        GroupAssignee.objects.create(user_id=self.user.id, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Unassigned"})
        self.assert_does_not_pass(self.dc, self.event_data)

    def test_render_label_team_in_org(self) -> None:
        label = AssignedToConditionHandler.render_label(
            {"targetType": "Team", "targetIdentifier": self.team.id},
            organization_id=self.organization.id,
        )
        assert label == f"The issue is assigned to team #{self.team.slug}"

    def test_render_label_team_foreign_org(self) -> None:
        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org)
        label = AssignedToConditionHandler.render_label(
            {"targetType": "Team", "targetIdentifier": other_team.id},
            organization_id=self.organization.id,
        )
        assert other_team.slug not in label
        assert label == "The issue is assigned to Team"

    def test_render_label_member_in_org(self) -> None:
        label = AssignedToConditionHandler.render_label(
            {"targetType": "Member", "targetIdentifier": self.user.id},
            organization_id=self.organization.id,
        )
        assert label == f"The issue is assigned to {self.user.username}"

    def test_render_label_member_foreign_org(self) -> None:
        other_org = self.create_organization()
        other_user = self.create_user(email="foreign@example.com")
        self.create_member(user=other_user, organization=other_org)
        label = AssignedToConditionHandler.render_label(
            {"targetType": "Member", "targetIdentifier": other_user.id},
            organization_id=self.organization.id,
        )
        assert other_user.username not in label
        assert other_user.email not in label
        assert label == "The issue is assigned to Member"
