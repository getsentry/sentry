from sentry.models.groupassignee import GroupAssignee
from sentry.rules.filters.assigned_to import AssignedToFilter
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class AssignedToFilterTest(RuleTestCase):
    rule_cls = AssignedToFilter

    def test_assigned_to_member_passes(self):
        event = self.get_event()
        GroupAssignee.objects.create(user_id=self.user.id, group=event.group, project=self.project)

        data = {
            "targetType": "Member",
            "targetIdentifier": self.user.id,
        }
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

    def test_assigned_to_member_fails(self):
        event = self.get_event()
        user = self.create_user()
        GroupAssignee.objects.create(user_id=user.id, group=event.group, project=self.project)

        data = {
            "targetType": "Member",
            "targetIdentifier": self.user.id,
        }
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)

    def test_assigned_to_team_passes(self):
        event = self.get_event()
        GroupAssignee.objects.create(team=self.team, group=event.group, project=self.project)

        data = {
            "targetType": "Team",
            "targetIdentifier": (self.team.id),
        }
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

    def test_assigned_to_team_fails(self):
        event = self.get_event()
        team = self.create_team(self.organization)
        GroupAssignee.objects.create(team=team, group=event.group, project=self.project)

        data = {
            "targetType": "Team",
            "targetIdentifier": (self.team.id),
        }
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)

    def test_assigned_to_no_one_passes(self):
        event = self.get_event()

        data = {
            "targetType": "Unassigned",
        }
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

    def test_assigned_to_no_one_fails(self):
        event = self.get_event()
        GroupAssignee.objects.create(user_id=self.user.id, group=event.group, project=self.project)

        data = {
            "targetType": "Unassigned",
        }
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)
