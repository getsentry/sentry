from functools import cached_property
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from jsonschema.exceptions import ValidationError

from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.rule import Rule, RuleSource
from sentry.models.rulesnooze import RuleSnooze
from sentry.monitors.models import Monitor, ScheduleType
from sentry.monitors.utils import ensure_cron_detector, get_detector_for_monitor
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
from sentry.utils.locking import UnableToAcquireLock
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
from sentry.workflow_engine.processors.detector import (
    UnableToAcquireLockApiError,
    ensure_default_detectors,
)
from sentry.workflow_engine.types import ERROR_DETECTOR_NAME, ISSUE_STREAM_DETECTOR_NAME
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class IssueAlertMigratorTest(TestCase):
    def setUp(self) -> None:
        self.rule_conditions = [
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
        self.issue_alert_data: dict[str, Any] = {
            "conditions": self.rule_conditions,
            "actions": self.action_data,
            "action_match": "any",
            "filter_match": "any",
            "frequency": 5,
            "group_type": IssueStreamGroupType.slug,
        }

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
                "attribute": self.filters[2]["attribute"],
                "value": self.filters[2]["value"],
            },
        ]

    @cached_property
    def issue_alert(self):
        # create_project_rule runs the IssueAlertMigrator
        return self.create_project_rule(
            name="test",
            condition_data=self.rule_conditions,
            action_match="any",
            filter_match="any",
            action_data=self.action_data,
            frequency=5,
        )

    def assert_nothing_migrated(self, issue_alert):
        assert not AlertRuleWorkflow.objects.filter(rule_id=issue_alert.id).exists()
        assert not AlertRuleDetector.objects.filter(rule_id=issue_alert.id).exists()

        assert Workflow.objects.all().count() == 0
        assert (
            Detector.objects.all().count() == 2
        )  # default Error Monitor and Issue Stream Detectors
        assert DataConditionGroup.objects.all().count() == 0
        assert DataCondition.objects.all().count() == 0
        assert Action.objects.all().count() == 0

    def assert_error_detector_migrated(self, issue_alert: Rule, workflow: Workflow) -> Detector:
        issue_alert_detector = AlertRuleDetector.objects.get(rule_id=issue_alert.id)
        error_detector = Detector.objects.get(id=issue_alert_detector.detector.id)
        assert error_detector.name == "Error Monitor"
        assert error_detector.project_id == self.project.id
        assert error_detector.enabled is True
        assert error_detector.owner_user_id is None
        assert error_detector.owner_team is None
        assert error_detector.type == ErrorGroupType.slug
        assert error_detector.config == {}

        error_detector_workflow = DetectorWorkflow.objects.get(detector=error_detector)
        assert error_detector_workflow.workflow == workflow

        return error_detector

    def assert_issue_stream_detector_migrated(
        self, project_id: int, workflow: Workflow
    ) -> Detector:
        issue_stream_detector = Detector.objects.get(
            project_id=project_id, type=IssueStreamGroupType.slug
        )
        assert issue_stream_detector.name == "Issue Stream"
        assert issue_stream_detector.enabled is True
        assert issue_stream_detector.owner_user_id is None
        assert issue_stream_detector.owner_team is None
        assert issue_stream_detector.config == {}

        issue_stream_detector_workflow = DetectorWorkflow.objects.get(
            detector=issue_stream_detector
        )
        assert issue_stream_detector_workflow.workflow == workflow

        return issue_stream_detector

    def assert_issue_alert_migrated(
        self, issue_alert, is_enabled=True, logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
    ):
        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule_id=issue_alert.id)

        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        assert workflow.name == issue_alert.label
        assert issue_alert.project
        assert workflow.organization_id == issue_alert.project.organization.id
        assert workflow.config == {"frequency": 5}
        assert workflow.date_added == issue_alert.date_added
        assert workflow.enabled == is_enabled

        self.assert_error_detector_migrated(issue_alert, workflow)
        self.assert_issue_stream_detector_migrated(self.project.id, workflow)

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

    def test_run(self) -> None:
        self.assert_issue_alert_migrated(self.issue_alert)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__issue_stream_detector(self) -> None:
        self.issue_alert_data["group_type"] = IssueStreamGroupType.slug
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )
        workflow = IssueAlertMigrator(issue_alert, self.user.id).run()
        self.assert_issue_stream_detector_migrated(issue_alert.project_id, workflow)

    def test_run__missing_matches(self) -> None:
        del self.issue_alert_data["action_match"]
        del self.issue_alert_data["filter_match"]
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )
        IssueAlertMigrator(issue_alert, self.user.id).run()
        self.assert_issue_alert_migrated(issue_alert, logic_type=DataConditionGroup.Type.ALL)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__none_matches(self) -> None:
        self.issue_alert_data["action_match"] = None
        self.issue_alert_data["filter_match"] = None
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )

        IssueAlertMigrator(issue_alert, self.user.id).run()
        self.assert_issue_alert_migrated(issue_alert, logic_type=DataConditionGroup.Type.ALL)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__disabled_rule(self) -> None:
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
            status=ObjectStatus.DISABLED,
        )
        IssueAlertMigrator(issue_alert, self.user.id).run()
        self.assert_issue_alert_migrated(issue_alert, is_enabled=False)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__snoozed_rule(self) -> None:
        # create_project_rule runs the IssueAlertMigrator
        issue_alert = self.create_project_rule(
            name="test",
            condition_data=self.rule_conditions,
            action_match="any",
            filter_match="any",
            action_data=self.action_data,
            frequency=5,
        )
        RuleSnooze.objects.create(rule=issue_alert)

        self.assert_issue_alert_migrated(issue_alert, is_enabled=False)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__snoozed_rule_for_user(self) -> None:
        # create_project_rule runs the IssueAlertMigrator
        issue_alert = self.create_project_rule(
            name="test",
            condition_data=self.rule_conditions,
            action_match="any",
            filter_match="any",
            action_data=self.action_data,
            frequency=5,
        )
        RuleSnooze.objects.create(rule=issue_alert, user_id=self.user.id)

        self.assert_issue_alert_migrated(issue_alert, is_enabled=True)

        dcg_actions = DataConditionGroupAction.objects.all()[0]
        action = dcg_actions.action
        assert action.type == Action.Type.SLACK

    def test_run__skip_actions(self) -> None:
        del self.issue_alert_data["actions"]
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )
        IssueAlertMigrator(issue_alert, self.user.id, should_create_actions=False).run()

        self.assert_issue_alert_migrated(issue_alert)

        assert DataConditionGroupAction.objects.all().count() == 0
        assert Action.objects.all().count() == 0

    def test_run__skip_invalid_conditions(self) -> None:
        invalid_conditions = [
            {
                "interval": "1h",
                "id": EventUniqueUserFrequencyConditionWithConditions.id,
                "value": -1,
                "comparisonType": "asdf",
            },
            {"id": RegressionEventCondition.id},
        ]
        self.issue_alert_data["conditions"] = invalid_conditions
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )

        IssueAlertMigrator(issue_alert, self.user.id, should_create_actions=False).run()

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule_id=issue_alert.id)

        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)

        assert workflow.when_condition_group
        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 1
        assert conditions.filter(
            type=Condition.REGRESSION_EVENT, comparison=True, condition_result=True
        ).exists()

        assert DataConditionGroupAction.objects.all().count() == 0
        assert Action.objects.all().count() == 0

    def test_run__skip_migration_if_no_valid_conditions(self) -> None:
        conditions = [
            {
                "interval": "1h",
                "id": EventUniqueUserFrequencyConditionWithConditions.id,
                "value": -1,
                "comparisonType": "asdf",
            },
        ]
        self.issue_alert_data["conditions"] = conditions
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )

        with pytest.raises(Exception):
            IssueAlertMigrator(issue_alert, self.user.id, should_create_actions=False).run()

        assert Workflow.objects.all().count() == 0

    def test_run__no_triggers(self) -> None:
        self.issue_alert_data["conditions"] = []
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )
        IssueAlertMigrator(issue_alert, self.user.id, should_create_actions=False).run()

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule_id=issue_alert.id)
        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)

        assert workflow.when_condition_group
        assert (
            DataCondition.objects.filter(condition_group=workflow.when_condition_group).count() == 0
        )

    def test_run__no_double_migrate(self) -> None:
        # there should be only 1
        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule_id=self.issue_alert.id)
        issue_alert_detector = AlertRuleDetector.objects.get(rule_id=self.issue_alert.id)
        Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        Detector.objects.get(id=issue_alert_detector.detector.id)

    def test_run__detector_exists(self) -> None:
        project_detector = self.create_detector(project=self.project)
        other_project_detector = self.create_detector(
            project=self.project, type=IssueStreamGroupType.slug
        )
        # does not create a new error detector
        error_detector = Detector.objects.get(project_id=self.project.id, type=ErrorGroupType.slug)
        assert error_detector.id == project_detector.id

        issue_stream_detector = Detector.objects.get(
            project_id=self.project.id, type=IssueStreamGroupType.slug
        )
        assert other_project_detector.id == issue_stream_detector.id

    def test_run__detector_lookup_exists(self) -> None:
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )
        AlertRuleDetector.objects.create(
            detector=self.create_detector(project=self.project),
            rule_id=issue_alert.id,
        )
        IssueAlertMigrator(issue_alert, self.user.id).run()
        AlertRuleWorkflow.objects.get(rule_id=issue_alert.id).workflow

    def test_run__with_conditions(self) -> None:
        self.create_project_rule(
            condition_data=self.conditions,
            action_match="all",
            filter_match="any",
            action_data=self.action_data,
        )
        assert DataCondition.objects.all().count() == 1
        dc = DataCondition.objects.get(type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT)
        assert dc.comparison == {
            "interval": "1h",
            "value": 50,
            "filters": self.expected_filters,
        }

    def test_run__every_event_condition__any(self) -> None:
        conditions = [
            {"id": EveryEventCondition.id},
            {"id": EveryEventCondition.id},
            {"id": RegressionEventCondition.id},
        ]
        self.create_project_rule(
            condition_data=conditions,
            action_match="any",
            filter_match="any",
            action_data=self.action_data,
        )
        assert DataCondition.objects.all().count() == 1
        dc = DataCondition.objects.get(type=Condition.REGRESSION_EVENT)
        assert dc.condition_group.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def test_run__every_event_condition__all(self) -> None:
        conditions = [
            {"id": EveryEventCondition.id},
            {"id": RegressionEventCondition.id},
        ]
        self.create_project_rule(
            condition_data=conditions,
            action_match="all",
            filter_match="any",
            action_data=self.action_data,
        )
        assert DataCondition.objects.all().count() == 1
        dc = DataCondition.objects.get(type=Condition.REGRESSION_EVENT)
        assert dc.condition_group.logic_type == DataConditionGroup.Type.ALL

    def test_run__cron_rule(self) -> None:
        # cron rule should not be connected to the error detector
        self.issue_alert_data["group_type"] = IssueStreamGroupType.slug
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
            source=RuleSource.CRON_MONITOR,
        )
        workflow = IssueAlertMigrator(issue_alert, self.user.id).run()

        assert AlertRuleWorkflow.objects.filter(rule_id=issue_alert.id).exists()
        assert not DetectorWorkflow.objects.filter(workflow=workflow).exists()

    def test_run__cron_rule_with_monitor(self) -> None:
        """
        Cron rule WITH monitor.slug filter should be connected to the cron detector
        """
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="Test Monitor",
            slug="test-monitor",
            config={"schedule_type": ScheduleType.CRONTAB, "schedule": "0 * * * *"},
        )
        ensure_cron_detector(monitor)

        # Update rule to be cron monitor source with monitor.slug filter
        self.issue_alert_data["group_type"] = IssueStreamGroupType.slug
        self.issue_alert_data["conditions"].append(
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "monitor.slug",
                "match": "eq",
                "value": "test-monitor",
            }
        )
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
            source=RuleSource.CRON_MONITOR,
        )
        workflow = IssueAlertMigrator(issue_alert, self.user.id).run()

        # Verify workflow created
        assert AlertRuleWorkflow.objects.filter(rule_id=issue_alert.id).exists()

        # Verify detector is linked to workflow
        detector = get_detector_for_monitor(monitor)
        assert detector is not None
        assert DetectorWorkflow.objects.filter(detector=detector, workflow=workflow).exists()

    def test_dry_run(self) -> None:
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )
        IssueAlertMigrator(issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(issue_alert)

    def test_dry_run__already_exists(self) -> None:
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )
        IssueAlertMigrator(issue_alert, self.user.id).run()

        with pytest.raises(Exception):
            IssueAlertMigrator(issue_alert, self.user.id, is_dry_run=True).run()

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule_id=issue_alert.id)
        issue_alert_detector = AlertRuleDetector.objects.get(rule_id=issue_alert.id)
        Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        Detector.objects.get(id=issue_alert_detector.detector.id)

    @patch(
        "sentry.workflow_engine.migration_helpers.issue_alert_migration.enforce_data_condition_json_schema"
    )
    def test_dry_run__data_condition_validation_fails(self, mock_enforce: MagicMock) -> None:
        mock_enforce.side_effect = ValidationError("oopsie")

        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )

        with pytest.raises(ValidationError):
            IssueAlertMigrator(issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(issue_alert)

    def test_dry_run__dcg_validation_fails(self) -> None:
        self.issue_alert_data["action_match"] = "asdf"
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )

        with pytest.raises(ValueError):
            IssueAlertMigrator(issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(issue_alert)

    def test_dry_run__workflow_validation_fails(self) -> None:
        self.issue_alert_data["frequency"] = -1
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )

        with pytest.raises(ValidationError):
            IssueAlertMigrator(issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(issue_alert)

    def test_dry_run__action_validation_fails(self) -> None:
        self.issue_alert_data["actions"] = [
            {
                "channel": "#my-channel",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "uuid": "test-uuid",
                "channel_id": "C01234567890",
            },
        ]
        issue_alert = Rule.objects.create(
            label="Test Alert",
            project=self.project,
            data=self.issue_alert_data,
        )

        with pytest.raises(ValueError):
            IssueAlertMigrator(issue_alert, self.user.id, is_dry_run=True).run()

        self.assert_nothing_migrated(issue_alert)


class TestEnsureDefaultDetectors(TestCase):
    def setUp(self) -> None:
        self.slugs = [ErrorGroupType.slug, IssueStreamGroupType.slug]
        self.names = [ERROR_DETECTOR_NAME, ISSUE_STREAM_DETECTOR_NAME]

    def test_ensure_default_detector(self) -> None:
        project = self.create_project()
        error_detector, issue_stream_detector = ensure_default_detectors(project)

        assert error_detector.name == ERROR_DETECTOR_NAME
        assert error_detector.project_id == project.id
        assert error_detector.type == ErrorGroupType.slug
        assert issue_stream_detector.name == ISSUE_STREAM_DETECTOR_NAME
        assert issue_stream_detector.project_id == project.id
        assert issue_stream_detector.type == IssueStreamGroupType.slug

    def test_ensure_default_detector__already_exists(self) -> None:
        project = self.create_project()
        detectors = ensure_default_detectors(project)
        with patch("sentry.workflow_engine.processors.detector.locks.get") as mock_lock:
            default_detectors = ensure_default_detectors(project)
            assert default_detectors[0].id == detectors[0].id
            assert default_detectors[1].id == detectors[1].id
            # No lock if it already exists.
            mock_lock.assert_not_called()

    def test_ensure_default_detector__lock_fails(self) -> None:
        with patch("sentry.workflow_engine.processors.detector.locks.get") as mock_lock:
            mock_lock.return_value.blocking_acquire.side_effect = UnableToAcquireLock
            with pytest.raises(UnableToAcquireLockApiError):
                project = self.create_project()
                ensure_default_detectors(project)
