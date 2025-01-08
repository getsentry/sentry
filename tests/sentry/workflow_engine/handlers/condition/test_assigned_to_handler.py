from sentry.models.groupassignee import GroupAssignee
from sentry.rules.filters.assigned_to import AssignedToFilter
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestAssignedToCondition(ConditionTestCase):
    condition = Condition.ASSIGNED_TO
    rule_cls = AssignedToFilter
    payload = {
        "id": AssignedToFilter.id,
        "targetType": "Member",
        "targetIdentifier": 0,
    }

    def setUp(self):
        super().setUp()
        self.job = WorkflowJob(
            {
                "event": self.group_event,
            }
        )
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={
                "targetType": "Member",
                "targetIdentifier": 0,
            },
            condition_result=True,
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "target_type": "Member",
            "target_identifier": 0,
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_assigned_to_member_passes(self):
        GroupAssignee.objects.create(user_id=self.user.id, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Member", "target_identifier": self.user.id})
        self.assert_passes(self.dc, self.job)

    def test_assigned_to_member_fails(self):
        user = self.create_user()
        GroupAssignee.objects.create(user_id=user.id, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Member", "target_identifier": self.user.id})
        self.assert_does_not_pass(self.dc, self.job)

    def test_assigned_to_team_passes(self):
        GroupAssignee.objects.create(team=self.team, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Team", "target_identifier": self.team.id})
        self.assert_passes(self.dc, self.job)

    def test_assigned_to_team_fails(self):
        team = self.create_team(self.organization)
        GroupAssignee.objects.create(team=team, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Team", "target_identifier": self.team.id})
        self.assert_does_not_pass(self.dc, self.job)

    def test_assigned_to_no_one_passes(self):
        self.dc.update(comparison={"target_type": "Unassigned"})
        self.assert_passes(self.dc, self.job)

    def test_assigned_to_no_one_fails(self):
        GroupAssignee.objects.create(user_id=self.user.id, group=self.group, project=self.project)
        self.dc.update(comparison={"target_type": "Unassigned"})
        self.assert_does_not_pass(self.dc, self.job)
