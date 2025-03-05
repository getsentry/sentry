from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.rulesnooze import RuleSnooze
from sentry.rules.age import AgeComparisonType
from sentry.rules.conditions.event_frequency import EventUniqueUserFrequencyConditionWithConditions
from sentry.rules.conditions.every_event import EveryEventCondition
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.testutils.cases import TestMigrations
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


class TestMigrateIssueAlerts(TestMigrations):
    migrate_from = "0033_workflow_name_256_char"
    migrate_to = "0034_migrate_issue_alerts"
    app = "workflow_engine"

    def setup_initial_state(self):
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
            name="test1",
            condition_data=conditions,
            action_match="any",
            filter_match="any",
            action_data=self.action_data,
            frequency=5,
        )

        self.issue_alert_missing_matches = self.create_project_rule(
            name="test2",
            condition_data=conditions,
            frequency=5,
            action_data=self.action_data,  # TODO: comment out to test sentry apps
        )
        data = self.issue_alert_missing_matches.data
        del data["action_match"]
        del data["filter_match"]
        self.issue_alert_missing_matches.update(data=data)

        self.issue_alert_none_matches = self.create_project_rule(
            name="test3",
            condition_data=conditions,
            frequency=5,
            action_data=self.action_data,  # TODO: comment out to test sentry apps
        )
        data = self.issue_alert_none_matches.data
        del data["action_match"]
        del data["filter_match"]
        self.issue_alert_none_matches.update(data=data)

        self.issue_alert_disabled = self.create_project_rule(
            name="test4",
            condition_data=conditions,
            status=ObjectStatus.DISABLED,
            frequency=5,
            action_data=self.action_data,  # TODO: comment out to test sentry apps
        )

        self.issue_alert_snoozed = self.create_project_rule(
            name="test5",
            condition_data=conditions,
            frequency=5,
            action_data=self.action_data,  # TODO: comment out to test sentry apps
        )
        RuleSnooze.objects.create(rule=self.issue_alert_snoozed)

        self.issue_alert_snoozed_for_user = self.create_project_rule(
            name="test5-2",
            condition_data=conditions,
            frequency=5,
            action_data=self.action_data,  # TODO: comment out to test sentry apps
        )
        RuleSnooze.objects.create(rule=self.issue_alert_snoozed_for_user, user_id=self.user.id)

        invalid_conditions = [
            {
                "interval": "1h",
                "id": EventUniqueUserFrequencyConditionWithConditions.id,
                "value": -1,
                "comparisonType": "asdf",
            },
            {"id": RegressionEventCondition.id},
        ]
        self.issue_alert_invalid_condition = self.create_project_rule(
            name="test6",
            condition_data=invalid_conditions,
            action_data=self.action_data,  # TODO: comment out to test sentry apps
        )

        self.issue_alert_no_valid_conditions = self.create_project_rule(
            name="test7",
            condition_data=[invalid_conditions[0]],
            frequency=5,
            action_data=self.action_data,  # TODO: comment out to test sentry apps
        )

        self.issue_alert_already_migrated = self.create_project_rule(
            name="test8",
            condition_data=conditions,
            action_match="any",
            filter_match="any",
            action_data=self.action_data,
            frequency=5,
        )
        IssueAlertMigrator(self.issue_alert_already_migrated, self.user.id).run()

        self.project2 = self.create_project(organization=self.organization)
        self.project2_detector = self.create_detector(project=self.project2)
        self.issue_alert_with_existing_detector = self.create_project_rule(
            project=self.project2,
            name="test9",
            condition_data=conditions,
            action_data=self.action_data,
            frequency=5,
        )

        self.issue_alert_every_event = self.create_project_rule(
            name="test10",
            condition_data=[
                {"id": EveryEventCondition.id},
                {"id": RegressionEventCondition.id},
            ],
            action_match="any",
            filter_match="any",
            action_data=self.action_data,
            frequency=5,
        )
        self.issue_alert_invalid_action = self.create_project_rule(
            name="test11",
            condition_data=conditions,
            action_match="any",
            filter_match="any",
            action_data=[
                {
                    "channel": "#my-channel",
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "uuid": "test-uuid",
                    "channel_id": "C01234567890",
                },
                {
                    "account": "11111",
                    "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                    "team": "2323213-bbbbbuuufffooobottt",
                    "uuid": "87654321-0987-6543-2109-876543210987",
                },
            ],
            frequency=5,
        )

    def assert_issue_alert_migrated(
        self, issue_alert, is_enabled=True, logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT
    ) -> Workflow:
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

        DetectorWorkflow.objects.get(detector=detector, workflow=workflow)

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

        return workflow

    def test(self):
        self._test_run()
        self._test_run__missing_matches()
        self._test_run__none_matches()
        self._test_run__disabled_rule()
        self._test_run__snoozed_rule()
        self._test_run__snoozed_rule_for_user()
        self._test_run__skip_invalid_conditions()
        self._test_run__skip_migration_if_no_valid_conditions()
        self._test_run__no_double_migrate()
        self._test_run__detector_exists()
        self._test_run__every_event_condition()
        self._test_run__invalid_action()

    def _test_run(self):
        workflow = self.assert_issue_alert_migrated(self.issue_alert)

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        dcg_actions = DataConditionGroupAction.objects.filter(condition_group=if_dcg)
        assert dcg_actions.count() == 1
        action = dcg_actions[0].action
        assert action.type == Action.Type.SLACK

    def _test_run__missing_matches(self):
        workflow = self.assert_issue_alert_migrated(
            self.issue_alert_missing_matches, logic_type=DataConditionGroup.Type.ALL
        )

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        dcg_actions = DataConditionGroupAction.objects.filter(condition_group=if_dcg)
        # assert dcg_actions.count() == 0
        assert dcg_actions.count() == 1
        action = dcg_actions[0].action
        assert action.type == Action.Type.SLACK

    def _test_run__none_matches(self):
        workflow = self.assert_issue_alert_migrated(
            self.issue_alert_none_matches, logic_type=DataConditionGroup.Type.ALL
        )

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        dcg_actions = DataConditionGroupAction.objects.filter(condition_group=if_dcg)
        # assert dcg_actions.count() == 0
        assert dcg_actions.count() == 1
        action = dcg_actions[0].action
        assert action.type == Action.Type.SLACK

    def _test_run__disabled_rule(self):
        workflow = self.assert_issue_alert_migrated(
            self.issue_alert_disabled, is_enabled=False, logic_type=DataConditionGroup.Type.ALL
        )

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        dcg_actions = DataConditionGroupAction.objects.filter(condition_group=if_dcg)
        # assert dcg_actions.count() == 0
        assert dcg_actions.count() == 1
        action = dcg_actions[0].action
        assert action.type == Action.Type.SLACK

    def _test_run__snoozed_rule(self):
        workflow = self.assert_issue_alert_migrated(
            self.issue_alert_snoozed, is_enabled=False, logic_type=DataConditionGroup.Type.ALL
        )

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        dcg_actions = DataConditionGroupAction.objects.filter(condition_group=if_dcg)
        # assert dcg_actions.count() == 0
        assert dcg_actions.count() == 1
        action = dcg_actions[0].action
        assert action.type == Action.Type.SLACK

    def _test_run__snoozed_rule_for_user(self):
        workflow = self.assert_issue_alert_migrated(
            self.issue_alert_snoozed_for_user,
            is_enabled=True,
            logic_type=DataConditionGroup.Type.ALL,
        )

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        dcg_actions = DataConditionGroupAction.objects.filter(condition_group=if_dcg)
        # assert dcg_actions.count() == 0
        assert dcg_actions.count() == 1
        action = dcg_actions[0].action
        assert action.type == Action.Type.SLACK

    def _test_run__skip_invalid_conditions(self):
        issue_alert_workflow = AlertRuleWorkflow.objects.get(
            rule=self.issue_alert_invalid_condition
        )

        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)

        assert workflow.when_condition_group
        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 1
        assert conditions.filter(
            type=Condition.REGRESSION_EVENT, comparison=True, condition_result=True
        ).exists()

        # assert Action.objects.all().count() == 0

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        dcg_actions = DataConditionGroupAction.objects.filter(condition_group=if_dcg)
        assert dcg_actions.count() == 1
        action = dcg_actions[0].action
        assert action.type == Action.Type.SLACK

    def _test_run__skip_migration_if_no_valid_conditions(self):
        assert (
            AlertRuleWorkflow.objects.filter(rule=self.issue_alert_no_valid_conditions).count() == 0
        )

    def _test_run__no_double_migrate(self):
        # there should be only 1
        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert_already_migrated)
        issue_alert_detector = AlertRuleDetector.objects.get(rule=self.issue_alert_already_migrated)
        Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        Detector.objects.get(id=issue_alert_detector.detector.id)

    def _test_run__detector_exists(self):
        # does not create a new error detector

        detector = Detector.objects.get(project_id=self.project2.id)
        assert detector == self.project2_detector

    def _test_run__every_event_condition(self):
        # removes every event condition
        workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert_every_event).workflow
        assert workflow.when_condition_group
        assert (
            DataCondition.objects.filter(condition_group=workflow.when_condition_group).count() == 1
        )
        dc = DataCondition.objects.filter(condition_group=workflow.when_condition_group)[0]
        assert dc.type == Condition.REGRESSION_EVENT
        assert dc.condition_group.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT

    def _test_run__invalid_action(self):
        workflow = self.assert_issue_alert_migrated(self.issue_alert_invalid_action)

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        dcg_actions = DataConditionGroupAction.objects.filter(condition_group=if_dcg)
        assert dcg_actions.count() == 1

        assert dcg_actions[0].action.type == Action.Type.OPSGENIE
