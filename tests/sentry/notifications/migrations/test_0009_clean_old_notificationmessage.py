from sentry.testutils.cases import TestMigrations
from django.db.migrations.state import StateApps


class CleanOldNotificationMessageTest(TestMigrations):
    migrate_from = "0008_remove_metric_alert_constraints_notificationmessage"
    migrate_to = "0009_clean_old_notificationmessage"
    app = "notifications"

    def setup_initial_state(self) -> None:
        self.alert_rule = self.create_alert_rule()
        self.trigger = self.create_alert_rule_trigger(alert_rule=self.alert_rule)
        self.trigger_action = self.create_alert_rule_trigger_action(alert_rule_trigger=self.trigger)
        self.incident = self.create_incident(alert_rule=self.alert_rule)
        self.action = self.create_action()
        self.group = self.create_group(project=self.project)

    def setup_before_migration(self, apps: StateApps) -> None:
        NotificationMessage = apps.get_model("notifications", "NotificationMessage")

        self.metric_alert_msg = NotificationMessage.objects.create(
            incident_id=self.incident.id,
            trigger_action_id=self.trigger_action.id,
            message_identifier="metric-alert",
        )
        self.workflow_engine_msg = NotificationMessage.objects.create(
            action_id=self.action.id,
            group_id=self.group.id,
            message_identifier="issue-alert",
        )

    def test_deletes_only_metric_alert_rows(self) -> None:
        NotificationMessage = self.apps.get_model("notifications", "NotificationMessage")

        assert not NotificationMessage.objects.filter(id=self.metric_alert_msg.id).exists()
        assert NotificationMessage.objects.filter(id=self.workflow_engine_msg.id).exists()
