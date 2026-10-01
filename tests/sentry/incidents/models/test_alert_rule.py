from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleStatus,
    AlertRuleTriggerAction,
)
from sentry.testutils.cases import TestCase


class IncidentAlertRuleRelationTest(TestCase):
    def test(self) -> None:
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(self.alert_rule)
        self.incident = self.create_incident(alert_rule=self.alert_rule, projects=[self.project])

        assert self.incident.alert_rule.id == self.alert_rule.id
        all_alert_rules = list(AlertRule.objects.all())
        assert self.alert_rule in all_alert_rules

        self.alert_rule.status = AlertRuleStatus.SNAPSHOT.value
        self.alert_rule.save()

        all_alert_rules = list(AlertRule.objects.all())
        assert self.alert_rule not in all_alert_rules
        assert self.incident.alert_rule.id == self.alert_rule.id


class AlertRuleFetchForOrganizationTest(TestCase):
    def test_empty(self) -> None:
        alert_rule = AlertRule.objects.fetch_for_organization(self.organization)
        assert [] == list(alert_rule)

    def test_simple(self) -> None:
        alert_rule = self.create_alert_rule()

        assert [alert_rule] == list(AlertRule.objects.fetch_for_organization(self.organization))

    def test_with_projects(self) -> None:
        project = self.create_project()
        alert_rule = self.create_alert_rule(projects=[project])

        assert [] == list(
            AlertRule.objects.fetch_for_organization(self.organization, [self.project])
        )
        assert [alert_rule] == list(
            AlertRule.objects.fetch_for_organization(self.organization, [project])
        )

    def test_multi_project(self) -> None:
        project = self.create_project()
        alert_rule1 = self.create_alert_rule(projects=[project, self.project])
        alert_rule2 = self.create_alert_rule(projects=[project])

        assert [alert_rule1] == list(
            AlertRule.objects.fetch_for_organization(self.organization, [self.project])
        )
        assert {alert_rule1, alert_rule2} == set(
            AlertRule.objects.fetch_for_organization(self.organization, [project])
        )

    def test_project_on_alert(self) -> None:
        project = self.create_project()
        alert_rule = self.create_alert_rule()
        alert_rule.projects.add(project)

        assert [alert_rule] == list(AlertRule.objects.fetch_for_organization(self.organization))

    def test_project_on_alert_and_snuba(self) -> None:
        project1 = self.create_project()
        alert_rule1 = self.create_alert_rule(projects=[project1])
        alert_rule1.projects.add(project1)

        # will fetch if there's 1 project in snuba
        assert [alert_rule1] == list(AlertRule.objects.fetch_for_organization(self.organization))

        project2 = self.create_project()
        alert_rule2 = self.create_alert_rule(projects=[project2, self.project])
        alert_rule2.projects.add(project1)

        # Will fetch if there's 1 project in snuba and 1 in alert rule
        assert {alert_rule1, alert_rule2} == set(
            AlertRule.objects.fetch_for_organization(self.organization, [project1])
        )


class AlertRuleTriggerActionTargetTest(TestCase):
    def setUp(self) -> None:
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=self.metric_alert)

    def test_user(self) -> None:
        trigger = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier=str(self.user.id),
        )
        assert trigger.target.user_id == self.user.id

    def test_invalid_user(self) -> None:
        trigger = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger,
            target_type=AlertRuleTriggerAction.TargetType.USER,
            target_identifier="10000000",
        )
        assert trigger.target is None

    def test_team(self) -> None:
        trigger = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger,
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(self.team.id),
        )
        assert trigger.target == self.team

    def test_team_from_another_organization(self) -> None:
        other_organization = self.create_organization()
        other_team = self.create_team(organization=other_organization)
        trigger = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger,
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(other_team.id),
        )
        assert trigger.target is None

    def test_invalid_team(self) -> None:
        trigger = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.alert_rule_trigger,
            target_type=AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier="10000000",
        )
        assert trigger.target is None

    def test_specific(self) -> None:
        email = "test@test.com"
        trigger = AlertRuleTriggerAction(
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC.value, target_identifier=email
        )
        assert trigger.target == email


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
