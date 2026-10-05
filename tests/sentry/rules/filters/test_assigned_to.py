from sentry.rules.filters.assigned_to import AssignedToFilter
from sentry.testutils.cases import RuleTestCase


class AssignedToFilterTest(RuleTestCase):
    rule_cls = AssignedToFilter

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
