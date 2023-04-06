from sentry.models import Rule, RuleSnooze
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class RuleSnoozeTest(APITestCase):
    endpoint = "sentry-api-0-rule-snooze"
    method = "post"

    def setUp(self):
        self.issue_alert_rule = Rule.objects.create(
            label="test rule", project=self.project, owner=self.team.actor
        )
        self.metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )

    def test_simple(self):
        self.login_as(user=self.user)
        data = {"userId": self.user.id, "ruleId": self.issue_alert_rule.id}
        response = self.get_response(
            self.organization.slug, self.project.slug, self.issue_alert_rule.id, **data
        )
        assert RuleSnooze.objects.filter(rule=self.issue_alert_rule.id).exists()
        assert response.status_code == 200
        assert len(response.data) == 6
        assert response.data["ownerId"] == self.user.id
