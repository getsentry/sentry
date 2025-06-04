from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.rule import Rule
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.cases import TestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteRuleFireHistoryTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        project = self.create_project()
        rule = self.create_project_rule(project)
        rule_fire_history = RuleFireHistory.objects.create(
            project=rule.project,
            rule=rule,
            group=self.group,
        )
        second_fire = RuleFireHistory.objects.create(
            project=rule.project,
            rule=rule,
            group=self.group,
        )
        parent_message = NotificationMessage.objects.create(
            message_identifier="abc123",
            parent_notification_message=None,
            rule_fire_history=rule_fire_history,
            rule_action_uuid="abc123",
        )
        message = NotificationMessage.objects.create(
            message_identifier="def456",
            parent_notification_message=parent_message,
            rule_fire_history=second_fire,
            rule_action_uuid="def456",
        )

        self.ScheduledDeletion.schedule(instance=rule_fire_history, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Rule.objects.filter(id=rule.id).exists()
        assert not RuleFireHistory.objects.filter(id=rule_fire_history.id).exists()
        assert RuleFireHistory.objects.filter(id=second_fire.id).exists()
        assert not NotificationMessage.objects.filter(id=parent_message.id).exists()
        assert not NotificationMessage.objects.filter(id=message.id).exists()
