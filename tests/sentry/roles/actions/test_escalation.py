from sentry.escalation_policies import EscalationPolicy
from sentry.models.projectownership import ProjectOwnership
from sentry.rules.actions.escalation import NotifyEscalationAction
from sentry.testutils.cases import PerformanceIssueTestCase, RuleTestCase
from sentry.testutils.skips import requires_snuba

pytestmark = requires_snuba


class NotifyEscalationActionTest(RuleTestCase, PerformanceIssueTestCase):
    rule_cls = NotifyEscalationAction

    def test_simple(self):
        event = self.get_event()
        rule = self.get_rule(data={"targetType": "IssueOwners"})
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        EscalationPolicy.objects.create(
            organization=self.organization, name="test_esc_policy", user_id=self.user.id
        )

        results = list(rule.after(event=event))
        assert len(results) == 1
