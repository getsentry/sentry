import pytest
from jsonschema.exceptions import ValidationError

from sentry.models.rulesnooze import RuleSnooze
from sentry.rules.age import AgeComparisonType
from sentry.rules.conditions.event_frequency import (
    ComparisonType,
    EventUniqueUserFrequencyConditionWithConditions,
)
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.rules.filters.event_attribute import EventAttributeFilter
from sentry.rules.filters.latest_release import LatestReleaseFilter
from sentry.rules.filters.tagged_event import TaggedEventFilter
from sentry.rules.match import MatchType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.workflow_engine.migration_helpers.issue_alert_dual_write import (
    delete_migrated_issue_alert,
    update_migrated_issue_alert,
)
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition


class RuleMigrationHelpersTest(TestCase):
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

    def test_rule_snooze_updates_workflow(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()
        rule_snooze = RuleSnooze.objects.create(rule=self.issue_alert)

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)

        assert workflow.enabled is False

        rule_snooze.delete()

        workflow.refresh_from_db()
        assert workflow.enabled is True

    def test_ignores_per_user_rule_snooze(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        RuleSnooze.objects.create(rule=self.issue_alert, user_id=self.user.id)
        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)

        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        workflow.refresh_from_db()
        assert workflow.enabled is True

    def test_update_issue_alert(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()
        conditions_payload = [
            {
                "id": FirstSeenEventCondition.id,
            },
            {
                "id": LatestReleaseFilter.id,
            },
        ]
        rule_data = self.issue_alert.data
        rule_data.update(
            {
                "action_match": "none",
                "filter_match": "all",
                "conditions": conditions_payload,
                "frequency": 60,
                "actions": [
                    {
                        "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                        "uuid": "test-uuid",
                    }
                ],
            }
        )

        self.issue_alert.update(
            label="hello world",
            owner_user_id=self.user.id,
            environment_id=self.environment.id,
            data=rule_data,
        )
        update_migrated_issue_alert(self.issue_alert)

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        assert workflow.name == self.issue_alert.label
        assert self.issue_alert.project
        assert workflow.organization_id == self.issue_alert.project.organization.id
        assert workflow.config == {"frequency": 60}
        assert workflow.owner_user_id == self.user.id
        assert workflow.owner_team_id is None

        assert workflow.when_condition_group
        assert workflow.when_condition_group.logic_type == DataConditionGroup.Type.NONE

        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 1
        assert conditions.filter(
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        ).exists()

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert if_dcg.logic_type == DataConditionGroup.Type.ALL
        filters = DataCondition.objects.filter(condition_group=if_dcg)
        assert filters.count() == 1
        assert filters.filter(
            type=Condition.LATEST_RELEASE,
            comparison=True,
            condition_result=True,
        ).exists()

        dcg_actions = DataConditionGroupAction.objects.get(condition_group=if_dcg)
        action = dcg_actions.action
        assert action.type == Action.Type.PLUGIN  # tested fully in test_migrate_rule_action.py

    def test_update_issue_alert__none_match(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()
        conditions_payload = [
            {
                "id": FirstSeenEventCondition.id,
            },
            {
                "id": LatestReleaseFilter.id,
            },
        ]
        rule_data = self.issue_alert.data
        rule_data.update(
            {
                "action_match": None,
                "filter_match": None,
                "conditions": conditions_payload,
                "frequency": 60,
                "actions": [
                    {
                        "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                        "uuid": "test-uuid",
                    }
                ],
            }
        )

        self.issue_alert.update(
            label="hello world",
            owner_user_id=self.user.id,
            environment_id=self.environment.id,
            data=rule_data,
        )
        update_migrated_issue_alert(self.issue_alert)

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        assert workflow.when_condition_group
        assert workflow.when_condition_group.logic_type == DataConditionGroup.Type.ALL

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert if_dcg.logic_type == DataConditionGroup.Type.ALL

    def test_update_issue_alert__with_conditions(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        rule_data = self.issue_alert.data
        rule_data.update(
            {
                "action_match": "none",
                "filter_match": "all",
                "conditions": self.conditions,
                "frequency": 60,
                "actions": [
                    {
                        "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                        "uuid": "test-uuid",
                    }
                ],
            }
        )

        self.issue_alert.update(
            label="hello world",
            owner_user_id=self.user.id,
            environment_id=self.environment.id,
            data=rule_data,
        )
        update_migrated_issue_alert(self.issue_alert)

        assert DataCondition.objects.all().count() == 1
        dc = DataCondition.objects.get(type=Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT)
        assert dc.comparison == {
            "interval": "1h",
            "value": 50,
            "filters": self.expected_filters,
        }

    def test_required_fields_only(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()
        # None fields are not updated

        rule_data = self.issue_alert.data
        rule_data.update(
            {
                "action_match": "none",
                "conditions": [],
                "actions": [
                    {
                        "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                        "uuid": "test-uuid",
                    }
                ],
            }
        )

        self.issue_alert.update(
            label="hello world",
            owner_user_id=None,
            owner_team_id=None,
            environment_id=None,
            data=rule_data,
        )
        update_migrated_issue_alert(self.issue_alert)

        issue_alert_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        workflow = Workflow.objects.get(id=issue_alert_workflow.workflow.id)
        assert workflow.environment is None
        assert workflow.owner_user_id is None
        assert workflow.owner_team_id is None
        assert workflow.config == {"frequency": 5}  # not migrated

        assert workflow.when_condition_group
        assert workflow.when_condition_group.logic_type == DataConditionGroup.Type.NONE

        conditions = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert conditions.count() == 0

        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group
        assert if_dcg.logic_type == DataConditionGroup.Type.ANY_SHORT_CIRCUIT
        filters = DataCondition.objects.filter(condition_group=if_dcg)
        assert filters.count() == 0

    def test_invalid_frequency(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()
        self.issue_alert.data["frequency"] = -1
        self.issue_alert.save()
        with pytest.raises(ValidationError):
            update_migrated_issue_alert(self.issue_alert)

    def test_delete_issue_alert(self):
        IssueAlertMigrator(self.issue_alert, self.user.id).run()

        alert_rule_workflow = AlertRuleWorkflow.objects.get(rule=self.issue_alert)
        workflow = alert_rule_workflow.workflow
        when_dcg = workflow.when_condition_group
        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow).condition_group

        assert when_dcg is not None
        assert if_dcg is not None

        conditions = DataCondition.objects.filter(condition_group=when_dcg)
        assert conditions.count() == 2
        filters = DataCondition.objects.filter(condition_group=if_dcg)
        assert filters.count() == 1

        delete_migrated_issue_alert(self.issue_alert)

        assert not AlertRuleWorkflow.objects.filter(rule=self.issue_alert).exists()
        assert not Workflow.objects.filter(id=workflow.id).exists()
        assert not DataConditionGroup.objects.filter(id=when_dcg.id).exists()
        assert not DataConditionGroup.objects.filter(id=if_dcg.id).exists()
        assert not DataCondition.objects.filter(condition_group=when_dcg).exists()
        assert not DataCondition.objects.filter(condition_group=if_dcg).exists()
        assert not DataConditionGroupAction.objects.filter(condition_group=if_dcg).exists()
        assert not Action.objects.all().exists()
