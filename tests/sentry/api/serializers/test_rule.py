from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.api.serializers.models.rule import RuleSerializer
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import WorkflowFireHistory


@freeze_time()
class RuleSerializerTest(TestCase):
    def test_last_triggered(self) -> None:
        rule = self.create_project_rule()

        # Initially no fire history
        result = serialize(rule, self.user, RuleSerializer(expand=["lastTriggered"]))
        assert result["lastTriggered"] is None

        # Create a workflow for the rule and record a fire
        workflow = IssueAlertMigrator(rule).run()
        WorkflowFireHistory.objects.create(
            workflow=workflow, group=self.group, event_id="test-event-id"
        )

        result = serialize(rule, self.user, RuleSerializer(expand=["lastTriggered"]))
        assert result["lastTriggered"] == timezone.now()
