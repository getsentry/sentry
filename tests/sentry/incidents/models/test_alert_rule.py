from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleStatus,
)
from sentry.testutils.cases import TestCase


class AlertRuleSnapshotTest(TestCase):
    def test(self) -> None:
        self.alert_rule = self.create_alert_rule()

        all_alert_rules = list(AlertRule.objects.all())
        assert self.alert_rule in all_alert_rules

        self.alert_rule.status = AlertRuleStatus.SNAPSHOT.value
        self.alert_rule.save()

        all_alert_rules = list(AlertRule.objects.all())
        assert self.alert_rule not in all_alert_rules


class AlertRuleFetchForProjectTest(TestCase):
    def test_simple(self) -> None:
        project = self.create_project()
        alert_rule = self.create_alert_rule(projects=[project])

        assert [alert_rule] == list(AlertRule.objects.fetch_for_project(project))

    def test_projects_on_snuba_and_alert(self) -> None:
        project1 = self.create_project()
        alert_rule1 = self.create_alert_rule(projects=[project1, self.project])

        project2 = self.create_project()
        alert_rule2 = self.create_alert_rule(projects=[project2, self.project])
        alert_rule2.projects.add(project2)

        assert {alert_rule1, alert_rule2} == set(AlertRule.objects.fetch_for_project(self.project))
