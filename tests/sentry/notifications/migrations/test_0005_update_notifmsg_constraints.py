from sentry.models.rulefirehistory import RuleFireHistory
from sentry.testutils.cases import TestMigrations


class UpdateNotificationMessageConstraintsTest(TestMigrations):
    migrate_from = "0004_notificationmessage_group_action_date_added_idx"
    migrate_to = "0005_update_notifmsg_constraints"
    app = "notifications"

    def setup_initial_state(self) -> None:
        self.project = self.create_project()
        self.rule = self.create_project_rule(project=self.project)
        self.group = self.create_group(project=self.project)
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project, rule=self.rule, group=self.group
        )

    def test_unique_constraint_removed(self) -> None:
        """Two rows with the same rule_fire_history + rule_action_uuid (and null
        open_period_start) would have violated
        singular_parent_message_per_rule_fire_history_rule_action_open_."""
        NotificationMessage = self.apps.get_model("notifications", "NotificationMessage")

        NotificationMessage.objects.create(
            rule_fire_history_id=self.rule_fire_history.id,
            rule_action_uuid="dup-uuid",
        )
        NotificationMessage.objects.create(
            rule_fire_history_id=self.rule_fire_history.id,
            rule_action_uuid="dup-uuid",
        )

        assert (
            NotificationMessage.objects.filter(
                rule_fire_history_id=self.rule_fire_history.id,
                rule_action_uuid="dup-uuid",
            ).count()
            == 2
        )

    def test_check_constraint_removed(self) -> None:
        """A row with no incident/trigger_action, no rule_fire_history/rule_action_uuid,
        and no action/group would have violated notification_type_mutual_exclusivity."""
        NotificationMessage = self.apps.get_model("notifications", "NotificationMessage")

        msg = NotificationMessage.objects.create()

        assert NotificationMessage.objects.filter(id=msg.id).exists()
