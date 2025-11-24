from django.db import models
from django.db.models import Value

from sentry.constants import ObjectStatus
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.types import FallthroughChoiceType
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.processors.action import get_unique_active_actions
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier


@region_silo_test
class TestActionDeduplication(TestCase):
    """
    Tests that we correctly deduplicate actions

    Notes:
    Bucket 1: Messaging & On-call actions create the dedup key the same way
    Bucket 2: Ticketing actions create the dedup key the same way
    Bucket 3: Other actions (sentry apps, plugins, webhooks, email) create the dedup key in their own way

    Interesting testcases configurations:
    1. Actions with the same dedup key but different data field are not deduplicated
    2. Actions in the same bucket are deduplicated or not depending on the method
    3. Actions in different buckets are not deduplicated
    """

    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

        self.slack_integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            name="Test Slack",
            external_id="slack-123",
        )

        self.slack_action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
        )

        # Common Jira integration used across Jira tests
        self.jira_integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            name="Test Jira",
            external_id="jira-123",
        )

    def test_deduplicate_actions_different_types(self) -> None:
        """Test that actions of different types are not deduplicated."""
        email_action = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.USER,
                "target_identifier": str(self.user.id),
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[self.slack_action.id, email_action.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since they're different types
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert self.slack_action.id in result_ids
        assert email_action.id in result_ids

    def test_deduplicate_actions_inactive_actions(self) -> None:
        """Test that inactive actions are not deduplicated."""
        email_action = self.create_action(
            type=Action.Type.EMAIL,
            config={"target_type": ActionTarget.USER, "target_identifier": str(self.user.id)},
            status=ObjectStatus.DISABLED,
        )

        actions_queryset = Action.objects.filter(
            id__in=[self.slack_action.id, email_action.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Only one action should remain
        # The inactive action should be filtered out
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        assert self.slack_action.id in result_ids

    def test_deduplicate_actions_same_slack_channels(self) -> None:
        """Test that Slack actions to the same channel are deduplicated."""
        slack_action_1 = self.slack_action
        slack_action_2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[slack_action_1.id, slack_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Only one action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1

    def test_deduplicate_actions_different_slack_channels(self) -> None:
        """Test that Slack actions to different channels are not deduplicated."""
        slack_action_1 = self.slack_action

        integration_2 = self.create_integration(
            organization=self.organization, external_id="slack-456"
        )

        # config is the exact same as the first slack action
        slack_action_2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=integration_2.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[slack_action_1.id, slack_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since they target different channels
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert slack_action_1.id in result_ids
        assert slack_action_2.id in result_ids

    def test_deduplicate_multiple_slack_actions_same_channel_different_name(self) -> None:
        """Test that Slack actions to the same channel but different names are deduplicated."""
        slack_action_1 = self.slack_action

        slack_action_2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel 2",
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[slack_action_1.id, slack_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Only one action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1

    def test_deduplicate_actions_same_slack_different_data(self) -> None:
        """Test that Slack actions with same config but different data are not deduplicated."""
        slack_action_1 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
            data={"notes": "first action"},
        )

        slack_action_2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
            data={"notes": "second action"},
        )

        actions_queryset = Action.objects.filter(
            id__in=[slack_action_1.id, slack_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since they have different data
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert slack_action_1.id in result_ids
        assert slack_action_2.id in result_ids

    def test_deduplicate_actions_different_slack_integrations(self) -> None:
        """Test that Slack actions with different integrations are not deduplicated."""
        # Create two Slack actions with same config but different data
        slack_action_1 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
            data={"notes": "first action"},
        )

        slack_action_2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
            data={"notes": "second action"},
        )

        actions_queryset = Action.objects.filter(
            id__in=[slack_action_1.id, slack_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since they have different data
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert slack_action_1.id in result_ids
        assert slack_action_2.id in result_ids

    def test_deduplicate_actions_email_same_target(self) -> None:
        """Test that email actions with same target are deduplicated."""
        # Create two email actions with same target
        email_action_1 = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.USER,
                "target_identifier": str(self.user.id),
            },
        )

        email_action_2 = self.create_action(
            type=Action.Type.EMAIL,
            config={"target_type": ActionTarget.USER, "target_identifier": str(self.user.id)},
        )

        actions_queryset = Action.objects.filter(
            id__in=[email_action_1.id, email_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Only one action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1

    def test_deduplicate_actions_email_different_target_identifier(self) -> None:
        """Test that email actions with different target identifiers are not deduplicated."""
        email_action_1 = self.create_action(
            type=Action.Type.EMAIL,
            config={"target_type": ActionTarget.USER, "target_identifier": str(self.user.id)},
        )

        self.user_2 = self.create_user()
        email_action_2 = self.create_action(
            type=Action.Type.EMAIL,
            config={"target_type": ActionTarget.USER, "target_identifier": str(self.user_2.id)},
        )

        actions_queryset = Action.objects.filter(
            id__in=[email_action_1.id, email_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since they have different targets
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert email_action_1.id in result_ids
        assert email_action_2.id in result_ids

    def test_deduplicate_actions_email_different_target_type(self) -> None:
        """Test that email actions with different target types are not deduplicated."""
        email_action_1 = self.create_action(
            type=Action.Type.EMAIL,
            config={"target_type": ActionTarget.USER, "target_identifier": str(self.user.id)},
        )

        email_action_2 = self.create_action(
            type=Action.Type.EMAIL,
            config={"target_type": ActionTarget.TEAM, "target_identifier": str(self.team.id)},
        )

        actions_queryset = Action.objects.filter(
            id__in=[email_action_1.id, email_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since they have different targets
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert email_action_1.id in result_ids
        assert email_action_2.id in result_ids

    def test_deduplicate_actions_email_different_fallthrough_type(self) -> None:
        """Test that email actions with different fallthrough types are not deduplicated."""
        email_action_1 = self.create_action(
            type=Action.Type.EMAIL,
            config={"target_type": ActionTarget.USER, "target_identifier": str(self.user.id)},
            data={
                "fallthrough_type": FallthroughChoiceType.ACTIVE_MEMBERS.value,
            },
        )

        email_action_2 = self.create_action(
            type=Action.Type.EMAIL,
            config={"target_type": ActionTarget.USER, "target_identifier": str(self.user.id)},
            data={},
        )

        actions_queryset = Action.objects.filter(
            id__in=[email_action_1.id, email_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since they have different targets
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert email_action_1.id in result_ids
        assert email_action_2.id in result_ids

    def test_deduplicate_actions_email_everything_is_same(self) -> None:
        email_action_1 = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.USER,
                "target_identifier": str(self.user.id),
            },
            data={
                "fallthrough_type": FallthroughChoiceType.ACTIVE_MEMBERS.value,
            },
        )

        email_action_2 = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.USER,
                "target_identifier": str(self.user.id),
            },
            data={
                "fallthrough_type": FallthroughChoiceType.ACTIVE_MEMBERS.value,
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[email_action_1.id, email_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Only one action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1

    def test_deduplicate_actions_sentry_app_same_identifier(self) -> None:
        """Test that Sentry App actions with same identifier are deduplicated."""
        # Create two Sentry App actions with same identifier
        sentry_app_action_1 = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_type": ActionTarget.SENTRY_APP,
                "target_identifier": "action-123",
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            },
        )

        sentry_app_action_2 = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_type": ActionTarget.SENTRY_APP,
                "target_identifier": "action-123",
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[sentry_app_action_1.id, sentry_app_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Only one action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1

    def test_deduplicate_actions_webhook_same_target_identifier(self) -> None:
        """Test that webhook actions with same target_identifier are deduplicated."""
        # Create two webhook actions with same target_identifier
        webhook_action_1 = self.create_action(
            type=Action.Type.WEBHOOK,
            config={
                "target_identifier": "https://example.com/webhook",
            },
        )

        webhook_action_2 = self.create_action(
            type=Action.Type.WEBHOOK,
            config={
                "target_identifier": "https://example.com/webhook",
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[webhook_action_1.id, webhook_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Only one action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1

    def test_deduplicate_actions_plugin_actions(self) -> None:
        plugin_action_1 = self.create_action(type=Action.Type.PLUGIN)

        plugin_action_2 = self.create_action(type=Action.Type.PLUGIN)

        actions_queryset = Action.objects.filter(
            id__in=[plugin_action_1.id, plugin_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # One action should remain since its a plugin action
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1

    def test_deduplicate_actions_mixed_types_integration_bucket(self) -> None:
        """Test deduplication with mixed integration action types (messaging & on-call)."""
        pagerduty_integration = self.create_integration(
            organization=self.organization,
            provider="pagerduty",
            name="Test PagerDuty",
            external_id="pd-123",
        )

        # Use setup Slack action and create PagerDuty action with same target identifier
        slack_action = self.slack_action

        pagerduty_action = self.create_action(
            type=Action.Type.PAGERDUTY,
            integration_id=pagerduty_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",  # Same identifier but different integration
                "target_display": "Test Service",
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[slack_action.id, pagerduty_action.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since they're for different integrations
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert slack_action.id in result_ids
        assert pagerduty_action.id in result_ids

    def test_deduplicate_actions_ticketing_actions(self) -> None:
        """Test that ticketing actions are deduplicated by integration_id and dynamic form field data."""
        # Create two Jira actions for the same integration but different projects
        jira_action_1 = self.create_action(
            type=Action.Type.JIRA,
            integration_id=self.jira_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
            },
            data={
                "dynamic_form_fields": [{"project": "PROJECT-1"}],
            },
        )

        jira_action_2 = self.create_action(
            type=Action.Type.JIRA,
            integration_id=self.jira_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
            },
            data={
                "dynamic_form_fields": [{"project": "PROJECT-2"}],
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[jira_action_1.id, jira_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since ticketing actions are deduplicated by integration_id and dynamic form field data
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert jira_action_1.id in result_ids
        assert jira_action_2.id in result_ids

    def test_deduplicate_actions_ticketing_actions_same_integration_and_data(self) -> None:
        # Create two Jira actions for the same integration but different projects
        jira_action_1 = self.create_action(
            type=Action.Type.JIRA,
            integration_id=self.jira_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
            },
            data={
                "dynamic_form_fields": [{"project": "PROJECT-1"}],
            },
        )

        jira_action_2 = self.create_action(
            type=Action.Type.JIRA,
            integration_id=self.jira_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
            },
            data={
                "dynamic_form_fields": [{"project": "PROJECT-1"}],
            },
        )

        actions_queryset = Action.objects.filter(
            id__in=[jira_action_1.id, jira_action_2.id]
        ).annotate(workflow_id=Value(1, output_field=models.IntegerField()))

        result = get_unique_active_actions(actions_queryset)

        # Only 1 action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1

    def test_deduplicate_actions_empty_queryset(self) -> None:
        """Test deduplication with empty queryset."""
        actions_queryset = Action.objects.none()

        result = get_unique_active_actions(actions_queryset)

        # Should return empty queryset
        assert list(result) == []

    def test_deduplicate_actions_single_action(self) -> None:
        """Test deduplication with single action."""
        single_action = self.slack_action

        actions_queryset = Action.objects.filter(id=single_action.id).annotate(
            workflow_id=Value(1, output_field=models.IntegerField())
        )

        result = get_unique_active_actions(actions_queryset)

        # Should return the single action
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        assert result_ids[0] == single_action.id

    def test_deduplicate_actions_same_actions_different_workflows(self) -> None:
        """Test that identical actions from different workflows are NOT deduplicated."""
        # Create two identical Slack actions
        slack_action_1 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
        )

        slack_action_2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
        )

        # Annotate with different workflow IDs
        actions_queryset = Action.objects.filter(
            id__in=[slack_action_1.id, slack_action_2.id]
        ).annotate(
            workflow_id=models.Case(
                models.When(id=slack_action_1.id, then=models.Value(1)),
                models.When(id=slack_action_2.id, then=models.Value(2)),
                output_field=models.IntegerField(),
            )
        )

        result = get_unique_active_actions(actions_queryset)

        # Both actions should remain since they're from different workflows
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert slack_action_1.id in result_ids
        assert slack_action_2.id in result_ids
