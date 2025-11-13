from datetime import timedelta

from django.utils import timezone

from sentry.models.rule import Rule
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import no_silo_test


@no_silo_test
@with_feature({"organizations:workflow-engine-ui": False})
class OrganizationAlertRuleDetailsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.project = self.create_project(fire_project_created=True)
        self.rule = Rule.objects.get(project=self.project)
        self.path = f"/organizations/{self.organization.slug}/issues/alerts/rules/{self.project.slug}/{self.rule.id}/details/"

    def test_empty_alert_rule_details(self) -> None:
        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')

    def test_alert_rule_with_issues(self) -> None:
        group = self.create_group()
        RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=group,
            date_added=timezone.now() - timedelta(days=1),
        )

        self.browser.get(self.path)
        self.browser.wait_until_not('[data-test-id="loading-indicator"]')
