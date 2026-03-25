from __future__ import annotations

from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any
from unittest import mock
from unittest.mock import patch
from uuid import uuid4

import responses
from django.test import override_settings
from rest_framework import status
from slack_sdk.web import SlackResponse

from sentry.api.endpoints.project_rules import get_max_alerts
from sentry.constants import ObjectStatus
from sentry.incidents.endpoints.serializers.utils import (
    get_fake_id_from_object_id,
    get_object_id_from_fake_id,
)
from sentry.integrations.slack.tasks.find_channel_id_for_rule import find_channel_id_for_rule
from sentry.integrations.slack.utils.channel import SlackChannelIdData
from sentry.models.environment import Environment
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.rules.conditions.event_attribute import EventAttributeCondition
from sentry.rules.conditions.event_frequency import (
    EventFrequencyCondition,
    EventFrequencyPercentCondition,
    EventUniqueUserFrequencyCondition,
)
from sentry.rules.conditions.existing_high_priority_issue import ExistingHighPriorityIssueCondition
from sentry.rules.conditions.first_seen_event import FirstSeenEventCondition
from sentry.rules.conditions.level import LevelCondition
from sentry.rules.conditions.new_high_priority_issue import NewHighPriorityIssueCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.rules.filters.assigned_to import AssignedToFilter
from sentry.rules.filters.event_attribute import EventAttributeFilter
from sentry.rules.filters.issue_category import IssueCategoryFilter
from sentry.rules.filters.issue_occurrences import IssueOccurrencesFilter
from sentry.rules.filters.issue_type import IssueTypeFilter
from sentry.rules.filters.latest_adopted_release_filter import LatestAdoptedReleaseFilter
from sentry.rules.filters.latest_release import LatestReleaseFilter
from sentry.rules.filters.level import LevelFilter
from sentry.rules.filters.tagged_event import TaggedEventFilter
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import install_slack, with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user import User
from sentry.workflow_engine.models import (
    Condition,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType
from tests.sentry.api.endpoints.test_project_rule_details import assert_serializer_results_match
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class ProjectRuleBaseTestCase(APITestCase, BaseWorkflowTest):
    endpoint = "sentry-api-0-project-rules"

    def setUp(self) -> None:
        self.rule = self.create_project_rule(project=self.project)
        self.slack_integration = install_slack(organization=self.organization)
        self.sentry_app = self.create_sentry_app(
            name="Pied Piper",
            organization=self.organization,
            schema={"elements": [self.create_alert_rule_action_schema()]},
        )
        self.sentry_app_installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug, organization=self.organization
        )
        self.sentry_app_settings_payload = [
            {"name": "title", "value": "Team Rocket"},
            {"name": "summary", "value": "We're blasting off again."},
        ]
        self.login_as(user=self.user)
        self.first_seen_condition = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
        ]
        self.notify_event_action = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction", "uuid": str(uuid4())}
        ]
        self.notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "name": "Send a notification to IssueOwners and if none can be found then send a notification to ActiveMembers",
                "uuid": str(uuid4()),
            }
        ]
        self.channel_id = "CSVK0921"
        self.slack_actions = [
            {
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "name": "Send a notification to the funinthesun Slack workspace to #team-team-team and show tags [] in notification",
                "workspace": self.slack_integration.id,
                "channel": "#team-team-team",
                "channel_id": self.channel_id,
            }
        ]
        # create single written workflow
        self.detector = self.create_detector(project=self.project)
        self.workflow_triggers = self.create_data_condition_group()
        self.workflow = self.create_workflow(
            when_condition_group=self.workflow_triggers,
            organization=self.detector.project.organization,
        )
        self.detector_workflow = self.create_detector_workflow(
            detector=self.detector, workflow=self.workflow
        )
        self.create_data_condition(  # trigger condition
            condition_group=self.workflow_triggers,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1d", "value": 100},
            condition_result=True,
        )
        self.workflow_filters = self.create_data_condition_group()
        self.workflow_dcg = self.create_workflow_data_condition_group(
            workflow=self.workflow, condition_group=self.workflow_filters
        )
        self.create_data_condition(  # filter condition
            condition_group=self.workflow_filters,
            type=Condition.EVENT_ATTRIBUTE,
            comparison={"attribute": "platform", "match": "eq", "value": "python"},
            condition_result=True,
        )
        self.action_group, self.action = self.create_workflow_action(self.workflow)


class ProjectRuleListTest(ProjectRuleBaseTestCase):
    def test_simple(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )
        assert len(response.data) == Rule.objects.filter(project=self.project).count()

    @with_feature("organizations:workflow-engine-rule-serializers")
    def test_workflow_engine(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )
        assert (
            len(response.data)
            == Workflow.objects.filter(organization=self.project.organization).count()
        )
        is_rule_resp = False
        workflow_resp_1 = response.data[0]
        workflow_resp_2 = response.data[1]

        if workflow_resp_1["id"] == str(self.rule.id):
            is_rule_resp = True

        if not is_rule_resp:
            assert workflow_resp_1["id"] == str(get_fake_id_from_object_id(self.workflow.id))
            assert workflow_resp_2["id"] == str(self.rule.id)
        else:
            assert workflow_resp_2["id"] == str(get_fake_id_from_object_id(self.workflow.id))
            assert workflow_resp_1["id"] == str(self.rule.id)

    @with_feature("organizations:workflow-engine-projectrulesendpoint-get")
    def test_workflow_engine_granular_flag(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )
        assert (
            len(response.data)
            == Workflow.objects.filter(organization=self.project.organization).count()
        )
        returned_ids = {item["id"] for item in response.data}
        assert str(self.rule.id) in returned_ids
        assert str(get_fake_id_from_object_id(self.workflow.id)) in returned_ids

    @with_feature("organizations:workflow-engine-rule-serializers")
    def test_unsupported_condition(self) -> None:
        """Test with an unsupported condition e.g. IssueResolvedTriggerCondition
        we should return what we can - the supported ones, and skip over the unsupported ones
        """
        detector = self.create_detector(project=self.project)
        workflow_triggers = self.create_data_condition_group()
        workflow = self.create_workflow(
            when_condition_group=workflow_triggers,
            organization=detector.project.organization,
            name="Issue resolved trigger workflow",
        )
        self.create_detector_workflow(detector=detector, workflow=workflow)
        self.create_data_condition(  # trigger condition
            condition_group=workflow_triggers,
            type=Condition.ISSUE_RESOLVED_TRIGGER,
            comparison=True,
            condition_result=True,
        )
        self.create_data_condition(  # trigger condition
            condition_group=workflow_triggers,
            type=Condition.EXISTING_HIGH_PRIORITY_ISSUE,
            comparison=True,
            condition_result=True,
        )
        workflow_filters = self.create_data_condition_group()
        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=workflow_filters
        )
        self.create_data_condition(  # filter condition
            condition_group=workflow_filters,
            type=Condition.EVENT_ATTRIBUTE,
            comparison={"attribute": "platform", "match": "eq", "value": "python"},
            condition_result=True,
        )
        self.create_workflow_action(workflow)
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )
        assert (
            len(response.data)
            == Workflow.objects.filter(organization=self.project.organization).count()
        )
        issue_resolved_trigger_resp = None

        for resp in response.data:
            if resp["name"] == workflow.name:
                issue_resolved_trigger_resp = resp

        assert issue_resolved_trigger_resp
        # assert we skipped over Condition.ISSUE_RESOLVED_TRIGGER and only have Condition.EXISTING_HIGH_PRIORITY_ISSUE
        assert len(issue_resolved_trigger_resp["conditions"]) == 1
        assert (
            issue_resolved_trigger_resp["conditions"][0]["id"]
            == ExistingHighPriorityIssueCondition.id
        )
        assert len(issue_resolved_trigger_resp["filters"]) == 1
        assert (
            issue_resolved_trigger_resp["errors"][0]["detail"]
            == f"Condition not supported: {Condition.ISSUE_RESOLVED_TRIGGER}"
        )

    @with_feature("organizations:workflow-engine-rule-serializers")
    def test_multiple_action_filters(self) -> None:
        """
        Test that if a workflow has multiple action filters (uses an if/then block) we only render 1 in the old UI and add to the error response
        """

        detector = self.create_detector(project=self.project)
        workflow_triggers = self.create_data_condition_group()
        workflow = self.create_workflow(
            when_condition_group=workflow_triggers,
            organization=detector.project.organization,
            name="Issue resolved trigger workflow",
        )
        self.create_detector_workflow(detector=detector, workflow=workflow)
        self.create_data_condition(  # trigger condition
            condition_group=workflow_triggers,
            type=Condition.ISSUE_RESOLVED_TRIGGER,
            comparison=True,
            condition_result=True,
        )
        self.create_data_condition(  # trigger condition
            condition_group=workflow_triggers,
            type=Condition.EXISTING_HIGH_PRIORITY_ISSUE,
            comparison=True,
            condition_result=True,
        )
        # First if/then block: action DCG with filter condition + action
        action_group1, _ = self.create_workflow_action(workflow)
        self.create_data_condition(
            condition_group=action_group1,
            type=Condition.EVENT_ATTRIBUTE,
            comparison={"attribute": "platform", "match": "eq", "value": "python"},
            condition_result=True,
        )
        # Second if/then block: action DCG with filter condition + action
        action_group2, _ = self.create_workflow_action(workflow)
        dc2 = self.create_data_condition(
            condition_group=action_group2,
            type=Condition.EVENT_ATTRIBUTE,
            comparison={"attribute": "platform", "match": "eq", "value": "java"},
            condition_result=True,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )

        multiple_action_filter_resp = None
        for resp in response.data:
            if resp["name"] == workflow.name:
                multiple_action_filter_resp = resp

        assert multiple_action_filter_resp
        # only the first if/then block's filter is rendered
        assert len(multiple_action_filter_resp["filters"]) == 1
        assert (
            multiple_action_filter_resp["errors"][0]["detail"]
            == "Multiple if/then blocks are not supported in this view. Only the first if/then block is displayed."
        )

        # remove the 2nd data condition so the if/then is just an action - this should still show the error
        dc2.delete()
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )

        multiple_action_filter_resp = None
        for resp in response.data:
            if resp["name"] == workflow.name:
                multiple_action_filter_resp = resp

        assert multiple_action_filter_resp
        # only the first if/then block's filter is rendered
        assert len(multiple_action_filter_resp["filters"]) == 1
        assert (
            multiple_action_filter_resp["errors"][0]["detail"]
            == "Multiple if/then blocks are not supported in this view. Only the first if/then block is displayed."
        )

    @with_feature("organizations:workflow-engine-rule-serializers")
    def test_workflow_engine_only_fetch_workflows_in_project(self) -> None:
        another_rule = self.create_project_rule(
            project=self.create_project(), name="other project rule"
        )
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )
        for resp in response.data:
            assert not resp["name"] == another_rule.label


class GetMaxAlertsTest(ProjectRuleBaseTestCase):
    @override_settings(MAX_SLOW_CONDITION_ISSUE_ALERTS=1)
    def test_get_max_alerts_slow(self) -> None:
        result = get_max_alerts(self.project, "slow")
        assert result == 1

    @with_feature("organizations:more-slow-alerts")
    @override_settings(MAX_SLOW_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS=2)
    def test_get_max_alerts_more_slow(self) -> None:
        result = get_max_alerts(self.project, "slow")
        assert result == 2

    @override_settings(MAX_FAST_CONDITION_ISSUE_ALERTS=1)
    def test_get_max_alerts_fast(self) -> None:
        result = get_max_alerts(self.project, "fast")
        assert result == 1

    @with_feature("organizations:more-fast-alerts")
    @override_settings(MAX_FAST_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_FAST_CONDITION_ISSUE_ALERTS=2)
    def test_get_max_alerts_more_fast_with_group_processing(self) -> None:
        result = get_max_alerts(self.project, "fast")
        assert result == 2

    @override_settings(MAX_FAST_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_FAST_CONDITION_ISSUE_ALERTS=2)
    def test_get_max_alerts_fast_with_group_processing(self) -> None:
        result = get_max_alerts(self.project, "fast")
        assert result == 1

    @override_settings(MAX_SLOW_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS=2)
    def test_get_max_alerts_slow_with_group_processing(self) -> None:
        result = get_max_alerts(self.project, "slow")
        assert result == 1


class GetProjectRulesTest(ProjectRuleBaseTestCase):
    method = "get"

    def test_simple(self) -> None:
        # attaches lastTriggered by default
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )
        assert len(response.data) == Rule.objects.filter(project=self.project).count()
        for rule in response.data:
            assert "lastTriggered" in rule


class CreateProjectRuleTest(ProjectRuleBaseTestCase):
    method = "post"

    def mock_conversations_info(self, channel):
        return patch(
            "slack_sdk.web.client.WebClient.conversations_info",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/conversations.info",
                req_args={"channel": channel},
                data={"ok": True, "channel": channel},
                headers={},
                status_code=200,
            ),
        )

    def clean_data(self, data):
        cleaned_data = []
        for datum in data:
            if datum.get("name"):
                del datum["name"]
            cleaned_data.append(datum)
        return cleaned_data

    def run_test(
        self,
        actions: Sequence[Mapping[str, Any]] | None = None,
        conditions: Sequence[Mapping[str, Any]] | None = None,
        filters: Sequence[Mapping[str, Any]] | None = None,
        expected_conditions: Sequence[Mapping[str, Any]] | None = None,
        name: str | None = "hello world",
        action_match: str | None = "any",
        filter_match: str | None = "any",
        frequency: int | None = 30,
        **kwargs: Any,
    ):
        owner = f"user:{self.user.id}"
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user = User.objects.get(id=self.user.id)  # reload user after setting actor
        query_args = {}
        if "environment" in kwargs:
            query_args["environment"] = kwargs["environment"]
        if filters:
            query_args["filters"] = filters
        if filter_match:
            query_args["filterMatch"] = filter_match
        if conditions:
            query_args["conditions"] = conditions
        if actions:
            query_args["actions"] = actions
        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            name=name,
            owner=owner,
            actionMatch=action_match,
            frequency=frequency,
            **query_args,
        )
        assert response.data["id"]
        assert response.data["owner"] == owner
        assert response.data["createdBy"] == {
            "id": self.user.id,
            "name": self.user.get_display_name(),
            "email": self.user.email,
        }

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == name
        assert rule.owner_user_id == self.user.id
        assert rule.owner_team_id is None
        assert rule.data["action_match"] == action_match
        assert rule.data["filter_match"] == filter_match

        updated_actions = self.clean_data(actions)
        assert rule.data["actions"] == updated_actions

        if conditions:
            updated_conditions = self.clean_data(conditions)

        assert rule.data["conditions"] == (
            expected_conditions if expected_conditions is not None else updated_conditions
        )
        assert rule.data["frequency"] == frequency
        assert rule.created_by_id == self.user.id
        if "environment" in kwargs:
            environment = kwargs["environment"]
            assert response.data["environment"] == environment
            if environment is None:
                assert rule.environment_id is None
            else:
                assert (
                    rule.environment_id
                    == Environment.objects.get(name=environment, projects=self.project).id
                )

        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.CREATED.value).exists()

        # Verify that the workflow engine serializer returns the same response shape.
        with self.feature("organizations:workflow-engine-rule-serializers"):
            workflow_response = self.get_success_response(
                self.project.organization.slug,
                self.project.slug,
                name=name,
                owner=owner,
                actionMatch=action_match,
                frequency=frequency,
                status_code=status.HTTP_201_CREATED,
                **query_args,
            )
        assert_serializer_results_match(response.data, workflow_response.data)

        return response

    def test_simple(self) -> None:
        self.run_test(actions=self.notify_issue_owners_action, conditions=self.first_seen_condition)

    def test_with_name(self) -> None:
        conditions = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "name": "A new issue is created",
            }
        ]
        actions = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "name": "Send a notification to IssueOwners and if none can be found then send a notification to ActiveMembers",
                "uuid": str(uuid4()),
            }
        ]

        self.run_test(actions=actions, conditions=conditions)

    def test_duplicate_rule(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="hellboy",
            frequency=1440,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
        )
        rule = Rule.objects.get(id=response.data["id"])

        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=rule.data["frequency"],
            owner=self.user.get_actor_identifier(),
            actionMatch=rule.data["action_match"],
            filterMatch=rule.data["filter_match"],
            actions=rule.data["actions"],
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            resp.data["name"][0]
            == f"This rule is an exact duplicate of '{rule.label}' in this project and may not be created."
        )

    def test_duplicate_rule_environment(self) -> None:
        """Test the duplicate check for various forms of environments being set (and not set)"""
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="no_env_rule",
            frequency=1440,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
        )
        no_env_rule = Rule.objects.get(id=response.data.get("id"))

        # first make sure we detect a duplicate rule if they're the same and don't have envs set
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="also_no_env_rule",
            frequency=1440,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        assert (
            response.data["name"][0]
            == f"This rule is an exact duplicate of '{no_env_rule.label}' in this project and may not be created."
        )

        # next test that we can create a rule that's a duplicate of the first rule but with an environment set
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="env_rule",
            frequency=1440,
            environment=self.environment.name,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
        )
        env_rule = Rule.objects.get(id=response.data.get("id"))

        # now test that we CAN'T create a duplicate rule with the same env as the last rule
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="same_env_rule",
            frequency=1440,
            environment=self.environment.name,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            response.data["name"][0]
            == f"This rule is an exact duplicate of '{env_rule.label}' in this project and may not be created."
        )

        # finally, test that we can create a rule that's duplicate except it has a different environment
        dev_env = self.create_environment(self.project, name="dev", organization=self.organization)
        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="diff_env_rule",
            frequency=1440,
            environment=dev_env.name,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
        )

    def test_pre_save(self) -> None:
        """Test that a rule with name data in the conditions and actions is saved without it"""
        action_uuid = str(uuid4())
        actions = [
            {
                "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                "name": "Send a notification to IssueOwners and if none can be found then send a notification to ActiveMembers",
                "uuid": action_uuid,
            }
        ]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="hello world",
            owner=f"user:{self.user.id}",
            environment=None,
            actionMatch="any",
            frequency=5,
            actions=actions,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_200_OK,
        )
        rule = Rule.objects.get(id=response.data.get("id"))
        assert rule.data["actions"][0] == {
            "id": "sentry.rules.actions.notify_event.NotifyEventAction",
            "uuid": action_uuid,
        }
        assert rule.data["conditions"][0] == {
            "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
        }

    def test_with_environment(self) -> None:
        Environment.get_or_create(self.project, "production")
        self.run_test(
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
            environment="production",
        )

    def test_with_null_environment(self) -> None:
        self.run_test(
            actions=self.notify_event_action, conditions=self.first_seen_condition, environment=None
        )

    def test_missing_name(self) -> None:
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    @override_settings(MAX_FAST_CONDITION_ISSUE_ALERTS=1)
    def test_exceed_limit_fast_conditions(self) -> None:
        Rule.objects.filter(project=self.project).delete()
        self.run_test(conditions=self.first_seen_condition, actions=self.notify_event_action)
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            resp.data["conditions"][0]
            == "You may not exceed 1 rules with this type of condition per project."
        )
        # Make sure pending deletions don't affect the process
        Rule.objects.filter(project=self.project).update(status=ObjectStatus.PENDING_DELETION)
        self.run_test(conditions=self.first_seen_condition, actions=self.notify_event_action)

    @override_settings(MAX_SLOW_CONDITION_ISSUE_ALERTS=1)
    @override_settings(MAX_MORE_SLOW_CONDITION_ISSUE_ALERTS=2)
    def test_exceed_limit_slow_conditions(self) -> None:
        actions = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction", "uuid": str(uuid4())}
        ]
        conditions = [
            {
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
                "interval": "1h",
                "value": 100.0,
                "comparisonType": "count",
            }
        ]
        Rule.objects.filter(project=self.project).delete()
        self.run_test(conditions=conditions, actions=actions)
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=actions,
            conditions=conditions,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            resp.data["conditions"][0]
            == "You may not exceed 1 rules with this type of condition per project."
        )
        # Make sure pending deletions don't affect the process
        Rule.objects.filter(project=self.project).update(status=ObjectStatus.PENDING_DELETION)
        self.run_test(conditions=conditions, actions=actions)
        actions.append(
            {
                "targetType": "Team",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": self.team.id,
                "uuid": str(uuid4()),
            }
        )
        with self.feature("organizations:more-slow-alerts"):
            self.run_test(conditions=conditions, actions=actions)

    def test_owner_perms(self) -> None:
        other_user = self.create_user()
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=other_user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=[],
            conditions=[],
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert str(response.data["owner"][0]) == "User is not a member of this organization"
        other_team = self.create_team(self.create_organization())
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=f"team:{other_team.id}",
            actionMatch="any",
            filterMatch="any",
            actions=[],
            conditions=[],
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert str(response.data["owner"][0]) == "Team is not a member of this organization"

    def test_team_owner(self) -> None:
        team = self.create_team(organization=self.organization, members=[self.user])
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            owner=f"team:{team.id}",
            actionMatch="any",
            filterMatch="any",
            frequency=5,
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
        )
        assert response.status_code == 200
        assert response.data["owner"] == f"team:{team.id}"

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.owner_team_id == team.id
        assert rule.owner_user_id is None

    def test_team_owner_not_member(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        team = self.create_team(organization=self.organization)
        member_user = self.create_user()
        self.create_member(
            user=member_user,
            organization=self.organization,
            role="member",
            teams=[self.team],
        )
        self.login_as(member_user)
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=f"team:{team.id}",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert "owner" in response.data
        assert str(response.data["owner"][0]) == "You can only assign teams you are a member of"

    def test_team_owner_not_member_with_team_admin_scope(self) -> None:
        """Test that users with team:admin scope can assign a team they're not a member of as the owner"""
        team = self.create_team(organization=self.organization)
        # Create a manager user who has team:admin scope
        manager_user = self.create_user()
        self.create_member(
            user=manager_user,
            organization=self.organization,
            role="manager",
            teams=[self.team],
        )
        self.login_as(manager_user)
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=f"team:{team.id}",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
        )
        assert response.status_code == 200
        assert response.data["owner"] == f"team:{team.id}"

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.owner_team_id == team.id
        assert rule.owner_user_id is None

    def test_user_owner_another_member(self) -> None:
        """Test that a user can assign another organization member as the rule owner.

        Unlike team ownership (which requires team membership), user ownership
        only requires the target user to be an organization member.
        """
        # XXX(oioki): this behavior could be updated in the future iterations of the rule ownership feature
        other_user = self.create_user()
        self.create_member(
            user=other_user,
            organization=self.organization,
            role="member",
        )
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=f"user:{other_user.id}",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=self.first_seen_condition,
        )
        assert response.status_code == 200
        assert response.data["owner"] == f"user:{other_user.id}"

        rule = Rule.objects.get(id=response.data["id"])
        assert rule.owner_user_id == other_user.id
        assert rule.owner_team_id is None

    def test_frequency_percent_validation(self) -> None:
        condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition",
            "interval": "1h",
            "value": 101.0,
            "comparisonType": "count",
        }
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            conditions=[condition],
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            str(response.data["conditions"][0]) == "Ensure this value is less than or equal to 100"
        )

        # Upper bound shouldn't be enforced when we're doing a comparison alert
        condition["comparisonType"] = "percent"
        condition["comparisonInterval"] = "1d"
        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=[condition],
            status_code=status.HTTP_200_OK,
        )

    def test_match_values(self) -> None:
        filters = [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "foo",
                "match": "is",
            }
        ]
        expected_filters = deepcopy(filters)
        expected_filters[0]["value"] = ""
        self.run_test(
            actions=self.notify_event_action, filters=filters, expected_conditions=expected_filters
        )

        # should fail if using another match type
        filters = [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "foo",
                "match": "eq",
            }
        ]
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            filters=filters,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    def test_with_filters(self) -> None:
        conditions: list[dict[str, Any]] = [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                "name": "A new issue is created",
            }
        ]
        filters: list[dict[str, Any]] = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]
        actions: list[dict[str, Any]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction", "uuid": str(uuid4())}
        ]
        self.run_test(
            actions=actions,
            conditions=conditions,
            filters=filters,
            expected_conditions=conditions + filters,
        )

    def test_with_no_filter_match(self) -> None:
        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
        ]
        actions: list[dict[str, Any]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction", "uuid": str(uuid4())}
        ]

        self.run_test(
            filter_match=None,
            actions=actions,
            conditions=conditions,
        )

    def test_with_filters_without_match(self) -> None:
        conditions: list[dict[str, Any]] = [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
        ]
        filters: list[dict[str, Any]] = [
            {"id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter", "value": 10}
        ]
        actions: list[dict[str, Any]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        ]

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="hello world",
            owner=self.user.get_actor_identifier(),
            conditions=conditions,
            filters=filters,
            actions=actions,
            actionMatch="any",
            frequency=30,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

        assert response.data == {
            "filterMatch": ["Must select a filter match (all, any, none) if filters are supplied."]
        }

    def test_no_actions(self) -> None:
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name="test",
            frequency=30,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="any",
            actions=[],
            conditions=self.first_seen_condition,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert resp.data["actions"][0] == "You must add an action for this alert to fire."

    @patch(
        "sentry.integrations.slack.actions.form.get_channel_id",
        return_value=SlackChannelIdData("#", None, True),
    )
    @patch.object(find_channel_id_for_rule, "apply_async")
    @patch("sentry.integrations.slack.utils.rule_status.uuid4")
    def test_kicks_off_slack_async_job(
        self,
        mock_uuid4,
        mock_find_channel_id_for_alert_rule,
        mock_get_channel_id,
    ):
        mock_uuid4.return_value = self.get_mock_uuid()
        actions = [
            {
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "name": (
                    "Send a notification to the funinthesun Slack workspace to"
                    " #team-team-team and show tags [] in notification"
                ),
                "workspace": str(self.slack_integration.id),
                "channel": "#team-team-team",
                "channel_id": "",
                "tags": "",
                "uuid": str(uuid4()),
            }
        ]
        payload: dict[str, Any] = {
            "name": "hello world",
            "owner": f"user:{self.user.id}",
            "environment": None,
            "actionMatch": "any",
            "frequency": 5,
            "actions": actions,
            "conditions": self.first_seen_condition,
        }

        self.get_success_response(
            self.organization.slug,
            self.project.slug,
            **payload,
            status_code=status.HTTP_202_ACCEPTED,
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user = User.objects.get(id=self.user.id)  # reload user to get actor
        assert not Rule.objects.filter(label=payload["name"]).exists()
        payload["actions"][0].pop("name")
        kwargs = {
            "name": payload["name"],
            "project": None,
            "project_id": self.project.id,
            "environment": payload.get("environment"),
            "action_match": payload["actionMatch"],
            "filter_match": payload.get("filterMatch"),
            "conditions": payload.get("conditions", []) + payload.get("filters", []),
            "actions": payload.get("actions", []),
            "frequency": payload.get("frequency"),
            "user_id": self.user.id,
            "owner": f"user:{self.user.id}",
            "uuid": "abc123",
        }
        call_args = mock_find_channel_id_for_alert_rule.call_args[1]["kwargs"]
        assert call_args == kwargs

    def test_condition_with_zero_value(self) -> None:
        condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "interval": "1h",
            "value": 0,
        }
        actions: list[dict[str, object]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction", "uuid": str(uuid4())}
        ]
        self.run_test(
            actions=actions,
            conditions=[condition],
            expected_conditions=[
                {
                    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                    "interval": "1h",
                    "value": 0,
                    "comparisonType": "count",
                }
            ],
        )

    def test_comparison_condition(self) -> None:
        condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "interval": "1h",
            "value": 50,
        }
        actions: list[dict[str, object]] = [
            {"id": "sentry.rules.actions.notify_event.NotifyEventAction", "uuid": str(uuid4())}
        ]
        self.run_test(
            actions=actions,
            conditions=[condition],
            expected_conditions=[
                {
                    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                    "interval": "1h",
                    "value": 50,
                    "comparisonType": "count",
                }
            ],
        )

        condition["comparisonType"] = "count"
        actions.append(
            {
                "targetType": "Team",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": self.team.id,
                "uuid": str(uuid4()),
            }
        )
        self.run_test(actions=actions, conditions=[condition])

        condition["comparisonType"] = "percent"
        condition["comparisonInterval"] = "1d"
        actions.append(
            {
                "targetType": "Member",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": self.user.id,
                "uuid": str(uuid4()),
            }
        )
        self.run_test(actions=actions, conditions=[condition])

    def test_comparison_condition_validation(self) -> None:
        condition = {
            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "interval": "1h",
            "value": 50,
            "comparisonType": "percent",
        }
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            name="hello world",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=[condition],
            frequency=30,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            str(response.data["conditions"][0])
            == "comparisonInterval is required when comparing by percent"
        )

        condition["comparisonInterval"] = "bad data"
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            name="hello world",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            conditions=[condition],
            frequency=30,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            str(response.data["conditions"][0])
            == "Select a valid choice. bad data is not one of the available choices."
        )

    def test_latest_adopted_release_filter_validation(self) -> None:
        filter = {
            "id": "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter",
            "oldest_or_newest": "oldest",
            "older_or_newer": "newer",
            "environment": self.environment.name + "fake",
        }
        response = self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            name="hello world",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            filters=[filter],
            frequency=30,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert (
            str(response.data["filters"][0])
            == "environment does not exist or is not associated with this organization"
        )
        filter["environment"] = self.environment.name
        self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            name="hello world",
            actionMatch="any",
            filterMatch="any",
            actions=self.notify_event_action,
            filters=[filter],
            frequency=30,
        )

    @responses.activate
    def test_create_sentry_app_action_success(self) -> None:
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=status.HTTP_202_ACCEPTED,
        )
        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "settings": self.sentry_app_settings_payload,
                "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                "hasSchemaFormConfig": True,
                "uuid": str(uuid4()),
            },
        ]
        payload = {
            "name": "my super cool rule",
            "owner": f"user:{self.user.id}",
            "conditions": [],
            "filters": [],
            "actions": actions,
            "filterMatch": "any",
            "actionMatch": "any",
            "frequency": 30,
        }

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            **payload,
            status_code=status.HTTP_200_OK,
        )
        new_rule_id = response.data["id"]
        assert new_rule_id is not None
        rule = Rule.objects.get(id=new_rule_id)
        assert rule.data["actions"] == actions
        assert len(responses.calls) == 1

    @responses.activate
    def test_create_sentry_app_action_failure(self) -> None:
        error_message = "Something is totally broken :'("
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            json={"message": error_message},
        )
        actions = [
            {
                "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                "settings": self.sentry_app_settings_payload,
                "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                "hasSchemaFormConfig": True,
            },
        ]
        payload = {
            "name": "my super cool rule",
            "owner": f"user:{self.user.id}",
            "conditions": [],
            "filters": [],
            "actions": actions,
            "filterMatch": "any",
            "actionMatch": "any",
            "frequency": 30,
        }

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            **payload,
            status_code=500,
        )
        assert len(responses.calls) == 1
        assert error_message in response.json().get("actions")[0]

    def test_post_rule_256_char_name(self) -> None:
        char_256_name = "wOOFmsWY80o0RPrlsrrqDp2Ylpr5K2unBWbsrqvuNb4Fy3vzawkNAyFJdqeFLlXNWF2kMfgMT9EQmFF3u3MqW3CTI7L2SLsmS9uSDQtcinjlZrr8BT4v8Q6ySrVY5HmiFO97w3awe4lA8uyVikeaSwPjt8MD5WSjdTI0RRXYeK3qnHTpVswBe9AIcQVMLKQXHgjulpsrxHc0DI0Vb8hKA4BhmzQXhYmAvKK26ZwCSjJurAODJB6mgIdlV7tigsFO"
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name=char_256_name,
            frequency=1440,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=self.first_seen_condition,
        )
        rule = Rule.objects.get(id=response.data["id"])
        assert rule.label == char_256_name

    def test_post_rule_over_256_char_name(self) -> None:
        char_257_name = "wOOFmsWY80o0RPrlsrrqDp2Ylpr5K2unBWbsrqvuNb4Fy3vzawkNAyFJdqeFLlXNWF2kMfgMT9EQmFF3u3MqW3CTI7L2SLsmS9uSDQtcinjlZrr8BT4v8Q6ySrVY5HmiFO97w3awe4lA8uyVikeaSwPjt8MD5WSjdTI0RRXYeK3qnHTpVswBe9AIcQVMLKQXHgjulpsrxHc0DI0Vb8hKA4BhmzQXhYmAvKK26ZwCSjJurAODJB6mgIdlV7tigsFOK"
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            name=char_257_name,
            frequency=1440,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            conditions=self.first_seen_condition,
            actions=self.notify_issue_owners_action,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert resp.data["name"][0] == "Ensure this field has no more than 256 characters."

    def test_rule_with_empty_comparison_interval(self) -> None:
        """
        Test that the serializer cleans up any empty strings passed in the data
        """
        conditions = [
            {
                "comparisonInterval": "",
                "comparisonType": "count",
                "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                "interval": "1h",
                "value": 5,
            },
        ]
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            name="hellboy",
            frequency=1440,
            owner=self.user.get_actor_identifier(),
            actionMatch="any",
            filterMatch="all",
            actions=self.notify_issue_owners_action,
            conditions=conditions,
        )
        clean_rule = Rule.objects.get(id=response.data.get("id"))
        assert not clean_rule.data.get("comparisonInterval")

    @with_feature("organizations:workflow-engine-rule-serializers")
    @responses.activate
    @mock.patch("sentry.integrations.slack.actions.form.validate_slack_entity_id")
    def test_workflow_engine(self, mock_validate_slack_entity_id: mock.MagicMock) -> None:
        conditions = [
            {"id": ExistingHighPriorityIssueCondition.id},
            {"id": NewHighPriorityIssueCondition.id},
            {"id": FirstSeenEventCondition.id},
            {"id": LevelCondition.id, "match": "eq", "level": "50"},
            {
                "id": EventAttributeCondition.id,
                "attribute": "message",
                "match": "eq",
                "value": "test",
            },
            {
                "id": EventFrequencyCondition.id,
                "interval": "1h",
                "value": 100,
                "comparisonType": "count",
            },
            {
                "id": EventFrequencyCondition.id,
                "interval": "1h",
                "value": 50,
                "comparisonType": "percent",
                "comparisonInterval": "1d",
            },
            {
                "id": EventUniqueUserFrequencyCondition.id,
                "interval": "1h",
                "value": 50,
                "comparisonType": "count",
            },
            {
                "id": EventUniqueUserFrequencyCondition.id,
                "interval": "1h",
                "value": 50,
                "comparisonType": "percent",
                "comparisonInterval": "1d",
            },
            {
                "id": EventFrequencyPercentCondition.id,
                "interval": "1h",
                "value": 50,
                "comparisonType": "count",
            },
            {
                "id": EventFrequencyPercentCondition.id,
                "interval": "1h",
                "value": 50,
                "comparisonType": "percent",
                "comparisonInterval": "1d",
            },
        ]
        filters = [
            {
                "id": TaggedEventFilter.id,
                "match": "is",
                "key": "environment",
                "value": "",  # initializing RuleBase requires "value" key
            },
            {
                "id": AgeComparisonFilter.id,
                "comparison_type": "older",
                "value": 10,
                "time": "hour",
            },
            {
                "id": AssignedToFilter.id,
                "targetType": "Member",
                "targetIdentifier": self.user.id,
            },
            {
                "id": IssueCategoryFilter.id,
                "value": "1",
                "include": "true",
            },
            {
                "id": IssueOccurrencesFilter.id,
                "value": "10",
            },
            {
                "id": IssueTypeFilter.id,
                "value": "error",
            },
            {
                "id": LatestAdoptedReleaseFilter.id,
                "oldest_or_newest": "oldest",
                "older_or_newer": "newer",
                "environment": self.environment.name + "fake",
            },
            {
                "id": LatestReleaseFilter.id,
            },
            {
                "id": LevelFilter.id,
                "match": "eq",
                "level": "50",
            },
            {
                "id": EventAttributeFilter.id,
                "attribute": "message",
                "match": "ns",
                "value": "",
            },
            {
                "id": AssignedToFilter.id,
                "targetType": "Unassigned",
                "targetIdentifier": "",
            },
        ]
        payload = {
            "name": "Owner Alert",
            "frequency": 1440,
            "environment": self.environment.name,
            "status": "active",
            "snooze": False,
            "conditions": conditions,
            "filters": filters,
            "actions": [
                {
                    "targetType": "Member",
                    "fallthroughType": "ActiveMembers",
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": self.user.id,
                },
                {
                    "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
                    "settings": self.sentry_app_settings_payload,
                    "sentryAppInstallationUuid": self.sentry_app_installation.uuid,
                    "hasSchemaFormConfig": True,
                    "uuid": str(uuid4()),
                },
                self.notify_issue_owners_action[0],
                self.notify_event_action[0],
                self.slack_actions[0],
            ],
            "actionMatch": "any",
            "filterMatch": "all",
            "owner": f"team:{self.team.id}",
            "projects": [self.project.slug],
        }
        responses.add(
            method=responses.POST,
            url="https://example.com/sentry/alert-rule",
            status=status.HTTP_202_ACCEPTED,
        )
        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            **payload,
        )
        assert len(response.data["conditions"]) == len(conditions)
        assert len(response.data["filters"]) == len(filters)
        assert len(response.data["actions"]) == len(payload["actions"])

        workflow = Workflow.objects.get(id=get_object_id_from_fake_id(int(response.data["id"])))
        assert workflow.environment is not None
        assert workflow.environment.name == payload["environment"]
        assert workflow.name == payload["name"]
        assert workflow.enabled is True

        assert DetectorWorkflow.objects.filter(
            workflow=workflow, detector__type=IssueStreamGroupType.slug
        ).exists()

        triggers = DataCondition.objects.filter(condition_group=workflow.when_condition_group)
        assert len(triggers) == len(payload["conditions"])
        # spot check
        event_attr_trigger = None
        for trigger in triggers:
            if trigger.type == Condition.EVENT_ATTRIBUTE.value:
                event_attr_trigger = trigger

        assert event_attr_trigger
        assert event_attr_trigger.comparison == {
            "match": "eq",
            "attribute": "message",
            "value": "test",
        }
        assert event_attr_trigger.condition_result is True

        wdcg = WorkflowDataConditionGroup.objects.get(workflow=workflow)
        dcgs = DataConditionGroup.objects.filter(id=wdcg.condition_group_id)
        dc_filters = DataCondition.objects.filter(condition_group__in=dcgs)
        assert len(dc_filters) == len(payload["filters"])
        # spot check
        tagged_event_filter = None
        for f in dc_filters:
            if f.type == Condition.TAGGED_EVENT.value:
                tagged_event_filter = f

        assert tagged_event_filter
        assert tagged_event_filter.comparison == {
            "match": "is",
            "key": "environment",
        }
        assert tagged_event_filter.condition_result is True

        dcgas = DataConditionGroupAction.objects.filter(condition_group__in=[dcg for dcg in dcgs])
        # spot check
        slack_action = None
        for action in [dcga.action for dcga in dcgas]:
            if action.type == "slack":
                slack_action = action

        assert slack_action
        assert slack_action.data == {"notes": "", "tags": ""}
        assert slack_action.config == {
            "target_type": 0,
            "target_display": "team-team-team",
            "target_identifier": "CSVK0921",
        }


class GetProjectRulesDeltaTest(APITestCase):
    """Verify legacy and workflow engine serializers produce identical output for dual-written rules."""

    endpoint = "sentry-api-0-project-rules"

    def test_dual_written_rule_parity(self) -> None:
        self.login_as(user=self.user)
        env = self.create_environment(project=self.project, name="production")
        rule = self.create_project_rule(
            project=self.project,
            name="Production alert",
            action_match="any",
            frequency=60,
            environment_id=env.id,
            condition_data=[
                {
                    "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                    "name": "A new issue is created",
                },
                {
                    "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                    "interval": "1h",
                    "value": 50,
                    "comparisonType": "count",
                    "name": "The issue is seen more than 50 times in 1h",
                },
            ],
            action_data=[
                {
                    "targetType": "IssueOwners",
                    "fallthroughType": "ActiveMembers",
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": "",
                    "name": "Send a notification to IssueOwners and if none can be found then send a notification to ActiveMembers",
                }
            ],
        )

        legacy_response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            status_code=status.HTTP_200_OK,
        )

        with self.feature("organizations:workflow-engine-rule-serializers"):
            we_response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=status.HTTP_200_OK,
            )

        assert len(legacy_response.data) == 1
        assert len(we_response.data) == 1
        legacy_rule = legacy_response.data[0]
        we_rule = we_response.data[0]
        assert legacy_rule["id"] == str(rule.id)

        known_differences: set[str] = set()

        mismatches: list[str] = []
        for field in set(list(legacy_rule.keys()) + list(we_rule.keys())):
            if field in known_differences:
                continue
            if field not in we_rule:
                mismatches.append(f"Missing from workflow engine: {field}")
            elif field not in legacy_rule:
                mismatches.append(f"Extra in workflow engine: {field}")
            elif legacy_rule[field] != we_rule[field]:
                mismatches.append(f"{field}: legacy={legacy_rule[field]!r}, we={we_rule[field]!r}")

        assert not mismatches, "Legacy vs workflow engine serializer differences:\n" + "\n".join(
            mismatches
        )
