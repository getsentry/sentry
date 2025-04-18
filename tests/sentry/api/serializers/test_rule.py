from sentry.api.serializers import serialize
from sentry.api.serializers.models.rule import WorkflowEngineRuleSerializer
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.conditions.event_frequency import EventUniqueUserFrequencyConditionWithConditions
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.conditions.tagged_event import TaggedEventCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.rules.filters.event_attribute import EventAttributeFilter
from sentry.rules.filters.tagged_event import TaggedEventFilter
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import WorkflowFireHistory


@freeze_time()
class RuleSerializerTest(TestCase):
    def setUp(self):
        conditions = [
            {"id": ReappearedEventCondition.id},
            {"id": RegressionEventCondition.id},
            {"id": TaggedEventCondition.id, "key": "foo", "match": "eq", "value": "bar"},
            {
                "id": AgeComparisonFilter.id,
                "comparison_type": "older",
                "value": 10,
                "time": "hour",
            },
            {
                "id": EventAttributeFilter.id,
                "attribute": "http.url",
                "match": "nc",
                "value": "localhost",
            },
        ]
        self.issue_alert = self.create_project_rule(
            name="test",
            condition_data=conditions,
            action_match="any",
            filter_match="any",
            frequency=5,
        )

    def assert_equal_serializers(self, issue_alert):
        RuleFireHistory.objects.create(project=self.project, rule=issue_alert, group=self.group)
        serialized_rule = serialize(issue_alert)

        workflow = IssueAlertMigrator(issue_alert).run()
        WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=self.group,
            has_fired_actions=True,
            event_id="fc6d8c0c43fc4630ad850ee518f1b9d0",
        )

        serialized_workflow_rule = serialize(workflow, self.user, WorkflowEngineRuleSerializer())

        # Pop and compare lists of dicts
        rule_conditions = serialized_rule.pop("conditions")
        workflow_conditions = serialized_workflow_rule.pop("conditions")
        rule_filters = serialized_rule.pop("filters")
        workflow_filters = serialized_workflow_rule.pop("filters")

        assert len(rule_conditions) == len(workflow_conditions)
        for condition in rule_conditions:
            assert condition in workflow_conditions

        assert len(rule_filters) == len(workflow_filters)
        for filter in rule_filters:
            assert filter in workflow_filters

        # TODO: test with actions
        serialized_rule.pop("actions")
        serialized_workflow_rule.pop("actions")

        assert serialized_rule == serialized_workflow_rule

    def test_rule_serializer(self):
        self.assert_equal_serializers(self.issue_alert)

    def test_special_condition(self):
        self.payload = {
            "interval": "1h",
            "id": EventUniqueUserFrequencyConditionWithConditions.id,
            "value": 50,
            "comparisonType": "count",
        }

        self.conditions = [
            {
                "id": TaggedEventFilter.id,
                "match": "eq",
                "key": "LOGGER",
                "value": "sentry.example",
            },
            {
                "id": TaggedEventFilter.id,
                "match": "is",
                "key": "environment",
                "value": "",  # initializing RuleBase requires "value" key
            },
            {
                "id": EventAttributeFilter.id,
                "match": "eq",
                "value": "hi",
                "attribute": "message",
            },
            {
                "id": EventAttributeFilter.id,
                "match": "is",
                "attribute": "platform",
                "value": "",  # initializing RuleBase requires "value" key
            },
        ]
        issue_alert = self.create_project_rule(
            name="test",
            condition_data=self.conditions + [self.payload],
            action_match="all",
            filter_match="all",
            frequency=30,
        )

        self.assert_equal_serializers(issue_alert)
