from sentry.models.rule import Rule
from sentry.testutils.cases import TestMigrations


class PriorityLevel:
    LOW = 25
    MEDIUM = 50
    HIGH = 75


DEFAULT_ALERT_LABEL = "Send a notification for new issues"
NEW_DEFAULT_ALERT_LABEL = "Send a notification for high priority issues"


class TestMigrateDefaultAlerts(TestMigrations):
    migrate_from = "0666_monitor_incident_default_grouphash"
    migrate_to = "0667_migrate_default_alerts_to_priority_ea"

    def setup_initial_state(self):
        self.organization.flags.early_adopter = True
        self.organization.save()
        # This alert should be migrated
        self.default_rule_data = {
            "match": "all",
            "conditions": [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
            ],
            "actions": [],
        }
        self.default_alert = Rule.objects.create(
            project=self.project,
            label=DEFAULT_ALERT_LABEL,
            data=self.default_rule_data,
        )
        self.default_alert.update(date_added=self.project.date_added)

        # This alert's condition doesn't match
        self.priority_rule_data = {
            "match": "all",
            "conditions": [
                {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"}
            ],
            "actions": [],
        }
        self.priority_alert = Rule.objects.create(
            project=self.project,
            label=DEFAULT_ALERT_LABEL,
            data=self.priority_rule_data,
        )

        # This alert has other conditions that don't match
        self.complex_rule_data = {
            "match": "all",
            "conditions": [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
                {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            ],
            "actions": [],
        }
        self.complex_rule = Rule.objects.create(
            project=self.project,
            label=DEFAULT_ALERT_LABEL,
            data=self.complex_rule_data,
        )

        # This alert's label doesn't match
        self.wrong_label_rule = Rule.objects.create(
            project=self.project,
            label="notifyme",
            data=self.default_rule_data,
        )

        non_ea_org = self.create_organization()
        non_ea_org.flags.early_adopter = False
        non_ea_org.save()
        non_ea_project = self.create_project(organization=non_ea_org)
        self.non_ea_rule = Rule.objects.create(
            project=non_ea_project,
            label=DEFAULT_ALERT_LABEL,
            data=self.default_rule_data,
        )
        self.non_ea_rule.update(date_added=non_ea_project.date_added)

    def test(self):
        # Check that this alert was migrated
        self.default_alert.refresh_from_db()
        assert self.default_alert.label == NEW_DEFAULT_ALERT_LABEL
        assert self.default_alert.data["conditions"] == [
            {"id": "sentry.rules.conditions.high_priority_issue.HighPriorityIssueCondition"}
        ]

        # These alerts should not have been migrated
        self.priority_alert.refresh_from_db()
        assert self.priority_alert.label == DEFAULT_ALERT_LABEL
        assert self.priority_alert.data["conditions"] == [
            {"id": "sentry.rules.conditions.high_priority_issue.HighPriorityIssueCondition"}
        ]

        self.complex_rule.refresh_from_db()
        assert self.complex_rule.label == DEFAULT_ALERT_LABEL
        assert self.complex_rule.data == self.default_rule_data

        self.wrong_label_rule.refresh_from_db()
        assert self.wrong_label_rule.label == "notifyme"
        assert self.wrong_label_rule.data == self.default_rule_data

        self.non_ea_rule.refresh_from_db()
        assert self.non_ea_rule.label == DEFAULT_ALERT_LABEL
        assert self.non_ea_rule.data == self.default_rule_data
