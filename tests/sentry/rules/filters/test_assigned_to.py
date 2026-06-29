from sentry.models.groupassignee import GroupAssignee
from sentry.rules.filters.assigned_to import AssignedToFilter
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class AssignedToFilterTest(RuleTestCase):
    rule_cls = AssignedToFilter

    def test_assigned_to_member_passes(self) -> None:
        event = self.get_event()
        GroupAssignee.objects.create(user_id=self.user.id, group=event.group, project=self.project)

        data = {
            "targetType": "Member",
            "targetIdentifier": self.user.id,
        }
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

    def test_assigned_to_member_fails(self) -> None:
        event = self.get_event()
        user = self.create_user()
        GroupAssignee.objects.create(user_id=user.id, group=event.group, project=self.project)

        data = {
            "targetType": "Member",
            "targetIdentifier": self.user.id,
        }
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)

    def test_assigned_to_team_passes(self) -> None:
        event = self.get_event()
        GroupAssignee.objects.create(team=self.team, group=event.group, project=self.project)

        data = {
            "targetType": "Team",
            "targetIdentifier": (self.team.id),
        }
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

    def test_assigned_to_team_fails(self) -> None:
        event = self.get_event()
        team = self.create_team(self.organization)
        GroupAssignee.objects.create(team=team, group=event.group, project=self.project)

        data = {
            "targetType": "Team",
            "targetIdentifier": (self.team.id),
        }
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)

    def test_assigned_to_no_one_passes(self) -> None:
        event = self.get_event()

        data = {
            "targetType": "Unassigned",
        }
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

    def test_assigned_to_no_one_fails(self) -> None:
        event = self.get_event()
        GroupAssignee.objects.create(user_id=self.user.id, group=event.group, project=self.project)

        data = {
            "targetType": "Unassigned",
        }
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)

    def test_render_label_team_in_org(self) -> None:
        rule = self.get_rule(data={"targetType": "Team", "targetIdentifier": self.team.id})
        assert rule.render_label() == f"The issue is assigned to team #{self.team.slug}"

    def test_render_label_team_foreign_org(self) -> None:
        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org)
        rule = self.get_rule(data={"targetType": "Team", "targetIdentifier": other_team.id})
        label = rule.render_label()
        assert other_team.slug not in label
        assert label == "The issue is assigned to Team"

    def test_render_label_member_in_org(self) -> None:
        rule = self.get_rule(data={"targetType": "Member", "targetIdentifier": self.user.id})
        assert rule.render_label() == f"The issue is assigned to {self.user.username}"

    def test_render_label_member_foreign_org(self) -> None:
        other_org = self.create_organization()
        other_user = self.create_user(email="foreign@example.com")
        self.create_member(user=other_user, organization=other_org)
        rule = self.get_rule(data={"targetType": "Member", "targetIdentifier": other_user.id})
        label = rule.render_label()
        assert other_user.username not in label
        assert other_user.email not in label
        assert label == "The issue is assigned to Member"
