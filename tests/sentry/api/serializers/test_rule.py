import pytest
from django.db import DEFAULT_DB_ALIAS, connections
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import serializers

from sentry.api.serializers import serialize
from sentry.api.serializers.models.rule import RuleSerializer, WorkflowEngineRuleSerializer
from sentry.integrations.models import OrganizationIntegration
from sentry.integrations.pagerduty.utils import add_service
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.rules.conditions.event_frequency import EventUniqueUserFrequencyConditionWithConditions
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.conditions.tagged_event import TaggedEventCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.rules.filters.event_attribute import EventAttributeFilter
from sentry.rules.filters.tagged_event import TaggedEventFilter
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.data_blobs import (
    AZURE_DEVOPS_ACTION_DATA_BLOBS,
    GITHUB_ACTION_DATA_BLOBS,
    JIRA_ACTION_DATA_BLOBS,
    JIRA_SERVER_ACTION_DATA_BLOBS,
)
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import WorkflowDataConditionGroup, WorkflowFireHistory
from sentry.workflow_engine.models.data_condition import Condition

ValidationError = serializers.ValidationError


@freeze_time()
class RuleSerializerTest(TestCase):
    def test_last_triggered_rule_only(self) -> None:
        rule = self.create_project_rule()

        # Initially no fire history
        result = serialize(rule, self.user, RuleSerializer(expand=["lastTriggered"]))
        assert result["lastTriggered"] is None

        # Create a RuleFireHistory
        RuleFireHistory.objects.create(project=self.project, rule=rule, group=self.group)

        result = serialize(rule, self.user, RuleSerializer(expand=["lastTriggered"]))
        assert result["lastTriggered"] == timezone.now()

    def test_last_triggered_with_workflow_only(self) -> None:
        rule = self.create_project_rule()

        # Create a workflow for the rule
        workflow = IssueAlertMigrator(rule).run()

        WorkflowFireHistory.objects.create(
            workflow=workflow, group=self.group, event_id="test-event-id"
        )

        result = serialize(rule, self.user, RuleSerializer(expand=["lastTriggered"]))
        assert result["lastTriggered"] == timezone.now()

    def test_last_triggered_with_workflow(self) -> None:
        rule = self.create_project_rule()

        # Create a workflow for the rule
        workflow = IssueAlertMigrator(rule).run()

        # Create an older RuleFireHistory
        rfh = RuleFireHistory.objects.create(project=self.project, rule=rule, group=self.group)
        rfh.update(date_added=before_now(hours=2))

        # Create a newer WorkflowFireHistory
        WorkflowFireHistory.objects.create(
            workflow=workflow, group=self.group, event_id="test-event-id"
        )

        result = serialize(rule, self.user, RuleSerializer(expand=["lastTriggered"]))
        assert result["lastTriggered"] == timezone.now()


@freeze_time()
class WorkflowRuleSerializerTest(TestCase):
    def setUp(self) -> None:
        self.conditions = [
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
            condition_data=self.conditions,
            action_match="any",
            filter_match="any",
            frequency=5,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )

    def assert_equal_serializers(self, issue_alert):
        RuleFireHistory.objects.create(project=self.project, rule=issue_alert, group=self.group)
        serialized_rule = serialize(issue_alert)

        workflow = IssueAlertMigrator(issue_alert).run()
        WorkflowFireHistory.objects.create(
            workflow=workflow,
            group=self.group,
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

        rule_actions = serialized_rule.pop("actions")
        workflow_actions = serialized_workflow_rule.pop("actions")

        assert len(rule_actions) == len(workflow_actions)
        for action in rule_actions:
            assert action in workflow_actions

        assert serialized_rule == serialized_workflow_rule

    def test_fetch_workflow_users(self) -> None:
        workflow = self.create_workflow(created_by_id=self.user.id)
        user_2 = self.create_user()
        workflow_2 = self.create_workflow(created_by_id=user_2.id)
        workflow_3 = self.create_workflow()
        self.create_user()

        users = WorkflowEngineRuleSerializer()._fetch_workflow_users(
            [workflow, workflow_2, workflow_3]
        )
        assert set(users.keys()) == {self.user.id, user_2.id}

    def test_fetch_workflow_projects(self) -> None:
        workflow = self.create_workflow()

        error_detector = self.create_detector(project=self.project, type="error")
        metric_detector = self.create_detector(project=self.project, type="metric_issue")
        workflow_2 = self.create_workflow()
        # Workflow connected to 2 detectors with the same project
        self.create_detector_workflow(detector=error_detector, workflow=workflow_2)
        self.create_detector_workflow(detector=metric_detector, workflow=workflow_2)

        project_2 = self.create_project()
        error_detector_2 = self.create_detector(project=project_2, type="error")
        workflow_3 = self.create_workflow()
        # Workflow connected to 2 detectors with different projects
        self.create_detector_workflow(detector=error_detector, workflow=workflow_3)
        self.create_detector_workflow(detector=error_detector_2, workflow=workflow_3)

        workflow_projects = WorkflowEngineRuleSerializer()._fetch_workflow_projects(
            [workflow, workflow_2, workflow_3]
        )
        assert workflow_projects == {
            workflow_2: {self.project},
            workflow_3: {self.project, project_2},
        }

    def test_fetch_workflows__prefetch(self) -> None:
        workflow_triggers = self.create_data_condition_group()
        workflow = self.create_workflow(when_condition_group=workflow_triggers)
        trigger_condition = self.create_data_condition(
            condition_group=workflow_triggers,
            type=Condition.EVENT_FREQUENCY_COUNT,
            comparison={"interval": "1d", "value": 100},
            condition_result=True,
        )
        workflow_filters = self.create_data_condition_group()
        workflow_dcg = self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=workflow_filters
        )
        filter_condition = self.create_data_condition(
            condition_group=workflow_filters,
            type=Condition.EVENT_ATTRIBUTE,
            comparison={"attribute": "platform", "match": "eq", "value": "python"},
            condition_result=True,
        )

        workflows = WorkflowEngineRuleSerializer()._fetch_workflows([workflow])
        workflow_with_prefetch = workflows[0]

        # Assert following FKs are prefetched and don't make additional queries
        with CaptureQueriesContext(connections[DEFAULT_DB_ALIAS]) as queries:
            assert workflow_with_prefetch.prefetched_wdcgs == [workflow_dcg]  # type: ignore[attr-defined]
            assert list(
                workflow_with_prefetch.prefetched_wdcgs[0].condition_group.conditions.all()  # type: ignore[attr-defined]
            ) == [filter_condition]
            assert workflow_with_prefetch.when_condition_group
            assert list(workflow_with_prefetch.when_condition_group.conditions.all()) == [
                trigger_condition
            ]

        assert len(queries) == 0

    def test_fetch_workflow_rule_ids(self) -> None:
        workflow = self.create_workflow()
        workflow_2 = self.create_workflow()
        self.create_alert_rule_workflow(workflow_id=workflow.id, rule_id=1)
        self.create_alert_rule_workflow(workflow_id=workflow_2.id, rule_id=2)

        assert WorkflowEngineRuleSerializer()._fetch_workflow_rule_ids([workflow, workflow_2]) == {
            workflow.id: 1,
            workflow_2.id: 2,
        }

    def test_fetch_workflow_created_by(self) -> None:
        users = {self.user.id: serialize_rpc_user(self.user)}
        workflow = self.create_workflow(created_by_id=self.user.id)

        assert WorkflowEngineRuleSerializer()._fetch_workflow_created_by(workflow, users) == {
            "id": self.user.id,
            "name": self.user.get_display_name(),
            "email": self.user.email,
        }

    def test_fetch_workflow_created_by__none(self) -> None:
        workflow = self.create_workflow()

        assert WorkflowEngineRuleSerializer()._fetch_workflow_created_by(workflow, {}) is None

    def test_fetch_workflow_owner__user(self) -> None:
        workflow = self.create_workflow(owner_user_id=self.user.id)
        assert (
            WorkflowEngineRuleSerializer()._fetch_workflow_owner(workflow) == f"user:{self.user.id}"
        )

    def test_fetch_workflow_owner__team(self) -> None:
        team = self.create_team()
        workflow = self.create_workflow(owner_team=team)
        assert WorkflowEngineRuleSerializer()._fetch_workflow_owner(workflow) == f"team:{team.id}"

    def test_fetch_workflow_owner__none(self) -> None:
        workflow = self.create_workflow()
        assert WorkflowEngineRuleSerializer()._fetch_workflow_owner(workflow) is None

    def test_generate_rule_conditions_filters(self) -> None:
        serialized_rule = serialize(self.issue_alert)

        workflow = IssueAlertMigrator(self.issue_alert).run()
        workflow_dcg = WorkflowDataConditionGroup.objects.get(workflow=workflow)

        conditions, filters = WorkflowEngineRuleSerializer()._generate_rule_conditions_filters(
            workflow, self.project, workflow_dcg
        )
        assert conditions == serialized_rule["conditions"]
        assert filters == serialized_rule["filters"]

    def test_fetch_workflow_last_triggered(self) -> None:
        workflow = self.create_workflow()
        workflow_2 = self.create_workflow()

        WorkflowFireHistory.objects.create(workflow=workflow, group=self.group, event_id="asdf")
        WorkflowFireHistory.objects.create(workflow=workflow, group=self.group, event_id="jklm")
        wfh = WorkflowFireHistory.objects.create(
            workflow=workflow_2, group=self.group, event_id="qwer"
        )
        wfh.update(date_added=before_now(days=1))
        wfh_2 = WorkflowFireHistory.objects.create(
            workflow=workflow_2, group=self.group, event_id="fdsa"
        )
        wfh_2.update(date_added=before_now(hours=1))

        assert WorkflowEngineRuleSerializer()._fetch_workflow_last_triggered(
            [workflow, workflow_2]
        ) == {workflow.id: timezone.now(), workflow_2.id: before_now(hours=1)}

    def test_rule_serializer(self) -> None:
        # default issue alert rule has legacy plugins and webhook actions
        self.issue_alert.update(owner_user_id=self.user.id)
        self.issue_alert.refresh_from_db()
        self.assert_equal_serializers(self.issue_alert)

    def test_special_condition(self) -> None:
        condition = {
            "interval": "1h",
            "id": EventUniqueUserFrequencyConditionWithConditions.id,
            "value": 50,
            "comparisonType": "count",
        }

        filters = [
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
            condition_data=filters + [condition],
            action_match="all",
            filter_match="all",
            frequency=30,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )

        self.assert_equal_serializers(issue_alert)

    def test_email_action_simple(self) -> None:
        action_data = [
            {
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": str(self.user.id),
                "targetType": "Member",
            },
            {
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": str(self.team.id),
                "targetType": "Team",
            },
        ]
        rule = self.create_project_rule(
            project=self.project,
            action_data=action_data,
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_email_action_issue_owners(self) -> None:
        action_data = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
            },
            {
                "targetType": "IssueOwners",
                "fallthroughType": "AllMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
            },
            {
                "targetType": "IssueOwners",
                "fallthroughType": "NoOne",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
            },
        ]
        rule = self.create_project_rule(
            project=self.project,
            action_data=action_data,
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_discord_action(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                provider="discord",
                name="Cool server",
                external_id="guild-id",
                organization=self.organization,
            )
        action_data = {
            "server": self.integration.id,
            "id": "sentry.integrations.discord.notify_action.DiscordNotifyServiceAction",
            "channel_id": "channel-id-123",
            "tags": "",
        }
        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_slack_action(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization,
                name="slack",
                provider="slack",
                external_id="slack:1",
                metadata={"access_token": "xoxb-access-token"},
            )
        action_data = {
            "workspace": self.integration.id,
            "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
            "channel_id": "C0123456789",
            "tags": "hellboy, meow",
            "notes": "this is a note",
            "channel": "test-notifications",
        }
        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_msteams_action(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization,
                name="My Team",
                provider="msteams",
                external_id="msteams:1",
                metadata={"installation_type": "team"},
            )
        action_data = {
            "team": self.integration.id,
            "id": "sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction",
            "channel_id": "19:abc123@thread.tacv2",
            "channel": "General",
        }
        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_opsgenie_action(self) -> None:
        team = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                provider="opsgenie",
                name="test-app",
                external_id="opsgenie:1",
            )
            org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=integration.id
            )
            org_integration.config = {"team_table": [team]}
            org_integration.save()
        action_data = {
            "account": integration.id,
            "team": team["id"],
            "priority": "P2",
            "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
        }
        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_pagerduty_action(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration, org_integration = self.create_provider_integration_for(
                self.organization,
                self.user,
                provider="pagerduty",
                name="Example",
                external_id="pagerduty:1",
                metadata={},
            )
            service = add_service(
                org_integration,
                service_name="Critical",
                integration_key="PND4F9",
            )
        action_data = {
            "account": integration.id,
            "service": str(service["id"]),
            "severity": "warning",
            "id": "sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction",
        }
        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_jira_action(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                provider="jira",
                name="Jira Cloud",
                external_id="jira:1",
            )
        action_data = {**JIRA_ACTION_DATA_BLOBS[0]}
        action_data["integration"] = integration.id
        action_data.pop("uuid")

        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_jira_server_action(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                provider="jira_server",
                name="Jira Server",
                external_id="jira_server:1",
            )
        action_data = {**JIRA_SERVER_ACTION_DATA_BLOBS[0]}
        action_data["integration"] = integration.id
        action_data.pop("uuid")

        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_github_action(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                provider="github",
                name="GitHub",
                external_id="github:1",
            )
        action_data = {**GITHUB_ACTION_DATA_BLOBS[0]}
        action_data["integration"] = integration.id
        action_data.pop("uuid")

        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_github_enterprise_action(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                provider="github_enterprise",
                name="GitHub Enterprise",
                external_id="github_enterprise:1",
            )
        action_data = {**GITHUB_ACTION_DATA_BLOBS[3]}
        action_data["integration"] = integration.id
        action_data.pop("uuid")

        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_azure_devops_action(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                provider="vsts",
                name="Azure DevOps",
                external_id="vsts:1",
            )
        action_data = {**AZURE_DEVOPS_ACTION_DATA_BLOBS[0]}
        action_data["integration"] = integration.id
        action_data.pop("uuid")

        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_sentry_app_render_label(self) -> None:
        schema = {"elements": [self.create_alert_rule_action_schema()]}
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application",
            is_alertable=True,
            schema=schema,
        )
        installation = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization
        )

        action_data = {
            "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
            "sentryAppInstallationUuid": installation.uuid,
        }
        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        self.assert_equal_serializers(rule)

    def test_sentry_app_render_label_no_alert_rule_action_schema(self) -> None:
        schema = {"elements": [self.create_issue_link_schema()]}
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application",
            is_alertable=True,
            schema=schema,
        )
        installation = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization
        )

        action_data = {
            "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
            "sentryAppInstallationUuid": installation.uuid,
        }
        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        with pytest.raises(ValidationError):
            self.assert_equal_serializers(rule)

    def test_sentry_app_render_label_no_installation(self) -> None:
        schema = {"elements": [self.create_alert_rule_action_schema()]}
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application",
            is_alertable=True,
            schema=schema,
        )
        installation = self.create_sentry_app_installation(
            slug=sentry_app.slug, organization=self.organization
        )

        action_data = {
            "id": "sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction",
            "sentryAppInstallationUuid": installation.uuid,
        }
        with assume_test_silo_mode(SiloMode.CONTROL):
            installation.delete()

        rule = self.create_project_rule(
            project=self.project,
            action_data=[action_data],
            condition_data=self.conditions,
            include_legacy_rule_id=False,
            include_workflow_id=False,
        )
        # actions part of response are both []
        self.assert_equal_serializers(rule)
