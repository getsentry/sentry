from unittest.mock import patch

import pytest
from jsonschema.exceptions import ValidationError

from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.rulesnooze import RuleSnooze
from sentry.rules.age import AgeComparisonType
from sentry.rules.conditions.event_frequency import (
    ComparisonType,
    EventUniqueUserFrequencyConditionWithConditions,
)
from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.rules.filters.event_attribute import EventAttributeFilter
from sentry.rules.filters.tagged_event import TaggedEventFilter
from sentry.rules.match import MatchType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import (
    Action,
    AlertRuleDetector,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition


class IssueAlertMigratorTest(TestCase):
    def setUp(self):
        conditions = [
            {"id": ReappearedEventCondition.id},
            {"id": RegressionEventCondition.id},
            {
                "id": AgeComparisonFilter.id,
                "comparison_type": AgeComparisonType.OLDER,
                "value": "10",
                "time": "hour",
            },
        ]
        integration = install_slack(self.organization)
        self.action_data = [
            {
                "channel": "#my-channel",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "workspace": str(integration.id),
                "uuid": "test-uuid",
                "channel_id": "C01234567890",
            },
        ]
        self.issue_alert = self.create_project_rule(
            name="test",
            condition_data=conditions,
            action_match="any",
            filter_match="any",
            action_data=self.action_data,
        )
        self.issue_alert.data["frequency"] = 5
        self.issue_alert.save()

        self.filters = [
            {
                "id": TaggedEventFilter.id,
                "match": MatchType.EQUAL,
                "key": "LOGGER",
                "value": "sentry.example",
            },
            {
                "id": TaggedEventFilter.id,
                "match": MatchType.IS_SET,
                "key": "environment",
            },
            {
                "id": EventAttributeFilter.id,
                "match": MatchType.EQUAL,
                "value": "hi",
                "attribute": "message",
            },
        ]
        self.conditions = [
            {
                "interval": "1h",
                "id": EventUniqueUserFrequencyConditionWithConditions.id,
                "value": 50,
                "comparisonType": ComparisonType.COUNT,
            }
        ] + self.filters

        self.expected_filters = [
            {
                "match": MatchType.EQUAL,
                "key": self.filters[0]["key"],
                "value": self.filters[0]["value"],
            },
            {"match": MatchType.IS_SET, "key": self.filters[1]["key"]},
            {
                "match": MatchType.EQUAL,
                "key": self.filters[2]["attribute"],
                "value": self.filters[2]["value"],
            },
        ]

    def assert_nothing_migrated(self, issue_alert):
        assert not AlertRuleWorkflow.objects.filter(rule=issue_alert).exists()
        assert not AlertRuleDetector.objects.filter(rule=issue_alert).exists()

        assert Workflow.objects.all().count() == 0
        assert Detector.objects.all().count() == 0
        assert DataConditionGroup.objects.all().count() == 0
        assert DataCondition.objects.all().count() == 0
        assert Action.objects.all().count() == 0

    def assert_issue_alert_migrated(
        self, issue_alert, is_enabled=True, logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
    ):
        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=issue_alert)
        issue_alert_detector = AlertRuleDetector.objects.get(rule=issue_alert)

        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        assert workflow.name == issue_alert.label
        assert issue_alert.project
        assert workflow.organization_id == issue_alert.project.organization.id
        assert workflow.config == {"frequency": 5}
        assert workflow.date_added == issue_alert.date_added
        assert workflow.enabled == is_enabled

        detector = Detector.objects.get(id=issue_alert_detector.detector.id)
        assert detector.name == "Error Detector"
        assert detector.project_id == self.project.id
        assert detector.enabled is True
        assert detector.owner_user_id is None
        assert detector.owner_team is None
        assert detector.type == ErrorGroupType.slug
        assert detector.config == {}

        detector_workflow = DetectorWorkflow.objects.get(detector=detector)
        assert detector_workflow.workflow == workflow

        assert workflow.when_condition_group
        assert workflow.when_condition_group.logic_type == logic_type
        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 2
        assert conditions.filter(
            type=Condition.REAPPEARED_EVENT, comparison=True, condition_result=True
        ).exists()
        assert conditions.filter(
            type=Condition.REGRESSION_EVENT, comparison=True, condition_result=True
        ).exists()

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert if_dcg.logic_type == logic_type
        filters = DataCondition.objects.filter(condition_group=if_dcg)
        assert filters.count() == 1
        assert filters.filter(
            type=Condition.AGE_COMPARISON,
            comparison={
                "comparison_type": AgeComparisonType.OLDER,
                "value": 10,
                "time": "hour",
            },
            condition_result=True,
        ).exists()

    def test_run(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        self.assert_issue_alert_migrated(self.issue_alert)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__missing_matches(self):
        data = self.issue_alert.data
        del data["action_match"]
        del data["filter_match"]
        self.issue_alert.update(data=data)
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        self.assert_issue_alert_migrated(self.issue_alert, logic_type=DataConditionGroup.Type.ALL)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__none_matches(self):
        data = self.issue_alert.data
        data["action_match"] = None
        data["filter_match"] = None
        self.issue_alert.update(data=data)
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        self.assert_issue_alert_migrated(self.issue_alert, logic_type=DataConditionGroup.Type.ALL)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__disabled_rule(self):
        self.issue_alert.update(status=ObjectStatus.DISABLED)
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        self.assert_issue_alert_migrated(self.issue_alert, is_enabled=False)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__snoozed_rule(self):
        RuleSnooze.objects.create(rule=self.issue_alert)
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        self.assert_issue_alert_migrated(self.issue_alert, is_enabled=False)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__snoozed_rule_for_user(self):
        RuleSnooze.objects.create(rule=self.issue_alert, user_id=self.user.id)
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        self.assert_issue_alert_migrated(self.issue_alert, is_enabled=True)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__skip_actions(self):
        IssueAlertMigrator(self.issue_alert, self.user.id, should_create_actions=False).run()

        self.assert_issue_alert_migrated(self.issue_alert)

        assert DataConditionGroupAction.objects.all().count() == 0
        assert Action.objects.all().count() == 0

    def test_run__no_double_migrate(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        # there should be only 1
        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        issue_alert_detector = AlertRuleDetector.objects.get(rule=self.issue_alert)
        Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        Detector.objects.get(id=issue_alert_detector.detector.id)

    def test_run__detector_exists(self):
        project_detector = self.create_detector(project=self.project)
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        # does not create a new error detector

        detector = Detector.objects.get(project_id=self.project.id)
        assert detector == project_detector

    def test_run__with_conditions(self):
        issue_alert = self.create_project_rule(
            condition_data=self.conditions,
            action_match="all",
            filter_match="any",
            action_data=self.action_data,
        )

        IssueAlertMigrator(issue_alert, self.user.id).run()
        assert DataCondition.objects.all().count() == 1
        dc = DataCondition.objects.get(type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT)
        assert dc.comparison == {
            "interval": "1h",
            "value": 50,
            "filters": self.expected_filters,
        }

    def test_run__every_event_condition__any(self):
        conditions = [
            {"id": EveryEventCondition.id},
            {"id": RegressionEventCondition.id},
        ]
        issue_alert = self.create_project_rule(
            condition_data=conditions,
            action_match="any",
            filter_match="any",
            action_data=self.action_data,
        )

        IssueAlertMigrator(issue_alert, self.user.id).run()
        assert DataCondition.objects.all().count() == 1
        dc = DataCondition.objects.get(type=Condition.REGRESSION_EVENT)
        assert dc.condition_group.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def test_run__every_event_condition__all(self):
        conditions = [
            {"id": EveryEventCondition.id},
            {"id": RegressionEventCondition.id},
        ]
        issue_alert = self.create_project_rule(
            condition_data=conditions,
            action_match="all",
            filter_match="any",
            action_data=self.action_data,
        )

        IssueAlertMigrator(issue_alert, self.user.id).run()
        assert DataCondition.objects.all().count() == 1
        dc = DataCondition.objects.get(type=Condition.REGRESSION_EVENT)
        assert dc.condition_group.logic_type == DataConditionGroup.Type.ALL

    def test_dry_run(self):
        IssueAlertMigrator(self.issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(self.issue_alert)

    def test_dry_run__already_exists(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        with pytest.raises(Exception):
            IssueAlertMigrator(self.issue_alert, self.user.id, is_dry_run=True).run()

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        issue_alert_detector = AlertRuleDetector.objects.get(rule=self.issue_alert)
        Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        Detector.objects.get(id=issue_alert_detector.detector.id)

    @patch(
        "sentry.workflow_engine.migration_helpers.issue_alert_migration.enforce_data_condition_json_schema"
    )
    def test_dry_run__data_condition_validation_fails(self, mock_enforce):
        mock_enforce.side_effect = ValidationError("oopsie")

        with pytest.raises(ValidationError):
            IssueAlertMigrator(self.issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(self.issue_alert)

    def test_dry_run__dcg_validation_fails(self):
        self.issue_alert.data["action_match"] = "asdf"

        with pytest.raises(ValueError):
            IssueAlertMigrator(self.issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(self.issue_alert)

    def test_dry_run__workflow_validation_fails(self):
        self.issue_alert.data["frequency"] = -1

        with pytest.raises(ValidationError):
            IssueAlertMigrator(self.issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(self.issue_alert)

    def test_dry_run__action_validation_fails(self):
        self.issue_alert.data["actions"] = [
            {
                "channel": "#my-channel",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "uuid": "test-uuid",
                "channel_id": "C01234567890",
            },
        ]

        with pytest.raises(ValueError):
            IssueAlertMigrator(self.issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(self.issue_alert)
