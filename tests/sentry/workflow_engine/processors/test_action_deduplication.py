from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.processors.action import deduplicate_actions
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

    def test_deduplicate_actions_different_types(self) -> None:
        """Test that actions of different types are not deduplicated."""
        # Create actions of different types
        slack_action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
        )

        email_action = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "test@example.com",
            },
        )

        actions_queryset = Action.objects.filter(id__in=[slack_action.id, email_action.id])
        action_to_workflow_ids = {slack_action.id: 1, email_action.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Both actions should remain since they're different types
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert slack_action.id in result_ids
        assert email_action.id in result_ids

    def test_deduplicate_actions_same_slack_channels(self) -> None:
        """Test that Slack actions to the same channel are deduplicated."""
        # Create two Slack actions to the same channel
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

        actions_queryset = Action.objects.filter(id__in=[slack_action_1.id, slack_action_2.id])
        action_to_workflow_ids = {slack_action_1.id: 1, slack_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Only one action should remain (the one with lower ID)
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        assert result_ids[0] == min(slack_action_1.id, slack_action_2.id)

    def test_deduplicate_actions_different_slack_channels(self) -> None:
        """Test that Slack actions to different channels are not deduplicated."""
        # Create two Slack actions to different channels
        slack_action_1 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel 1",
            },
        )

        slack_action_2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-456",
                "target_display": "Test Channel 2",
            },
        )

        actions_queryset = Action.objects.filter(id__in=[slack_action_1.id, slack_action_2.id])
        action_to_workflow_ids = {slack_action_1.id: 1, slack_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Both actions should remain since they target different channels
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert slack_action_1.id in result_ids
        assert slack_action_2.id in result_ids

    def test_deduplicate_actions_same_slack_different_data(self) -> None:
        """Test that Slack actions with same config but different data are not deduplicated."""
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

        actions_queryset = Action.objects.filter(id__in=[slack_action_1.id, slack_action_2.id])
        action_to_workflow_ids = {slack_action_1.id: 1, slack_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

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
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "test@example.com",
            },
        )

        email_action_2 = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "test@example.com",
            },
        )

        actions_queryset = Action.objects.filter(id__in=[email_action_1.id, email_action_2.id])
        action_to_workflow_ids = {email_action_1.id: 1, email_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Only one action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        # We keep the action with the lowest ID
        assert result_ids[0] == min(email_action_1.id, email_action_2.id)

    def test_deduplicate_actions_email_different_targets(self) -> None:
        """Test that email actions with different targets are not deduplicated."""
        # Create two email actions with different targets
        email_action_1 = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "test1@example.com",
            },
        )

        email_action_2 = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "test2@example.com",
            },
        )

        actions_queryset = Action.objects.filter(id__in=[email_action_1.id, email_action_2.id])
        action_to_workflow_ids = {email_action_1.id: 1, email_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Both actions should remain since they have different targets
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert email_action_1.id in result_ids
        assert email_action_2.id in result_ids

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
        )
        action_to_workflow_ids = {sentry_app_action_1.id: 1, sentry_app_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Only one action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        assert result_ids[0] == min(sentry_app_action_1.id, sentry_app_action_2.id)

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

        actions_queryset = Action.objects.filter(id__in=[webhook_action_1.id, webhook_action_2.id])
        action_to_workflow_ids = {webhook_action_1.id: 1, webhook_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Only one action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        assert result_ids[0] == min(webhook_action_1.id, webhook_action_2.id)

    def test_deduplicate_actions_plugin_actions(self) -> None:
        plugin_action_1 = self.create_action(type=Action.Type.PLUGIN)

        plugin_action_2 = self.create_action(type=Action.Type.PLUGIN)

        actions_queryset = Action.objects.filter(id__in=[plugin_action_1.id, plugin_action_2.id])
        action_to_workflow_ids = {plugin_action_1.id: 1, plugin_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # One action should remain since its a plugin action
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        assert plugin_action_1.id in result_ids
        assert plugin_action_2.id not in result_ids

    def test_deduplicate_actions_mixed_types_integration_bucket(self) -> None:
        """Test deduplication with mixed integration action types (messaging & on-call)."""
        pagerduty_integration = self.create_integration(
            organization=self.organization,
            provider="pagerduty",
            name="Test PagerDuty",
            external_id="pd-123",
        )

        # Create Slack and PagerDuty actions with same target identifier
        slack_action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
        )

        pagerduty_action = self.create_action(
            type=Action.Type.PAGERDUTY,
            integration_id=pagerduty_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",  # Same identifier but different integration
                "target_display": "Test Service",
            },
        )

        actions_queryset = Action.objects.filter(id__in=[slack_action.id, pagerduty_action.id])
        action_to_workflow_ids = {slack_action.id: 1, pagerduty_action.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Both actions should remain since they're for different integrations
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert slack_action.id in result_ids
        assert pagerduty_action.id in result_ids

    def test_deduplicate_actions_ticketing_actions(self) -> None:
        """Test that ticketing actions are deduplicated by integration_id and dynamic form field data."""
        jira_integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            name="Test Jira",
            external_id="jira-123",
        )

        # Create two Jira actions for the same integration but different projects
        jira_action_1 = self.create_action(
            type=Action.Type.JIRA,
            integration_id=jira_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
            },
            data={
                "dynamic_form_fields": [{"project": "PROJECT-1"}],
            },
        )

        jira_action_2 = self.create_action(
            type=Action.Type.JIRA,
            integration_id=jira_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
            },
            data={
                "dynamic_form_fields": [{"project": "PROJECT-2"}],
            },
        )

        actions_queryset = Action.objects.filter(id__in=[jira_action_1.id, jira_action_2.id])
        action_to_workflow_ids = {jira_action_1.id: 1, jira_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Both actions should remain since ticketing actions are deduplicated by integration_id and dynamic form field data
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 2
        assert jira_action_1.id in result_ids
        assert jira_action_2.id in result_ids

    def test_deduplicate_actions_ticketing_actions_same_integration_and_data(self) -> None:
        jira_integration = self.create_integration(
            organization=self.organization,
            provider="jira",
            name="Test Jira",
            external_id="jira-123",
        )

        # Create two Jira actions for the same integration but different projects
        jira_action_1 = self.create_action(
            type=Action.Type.JIRA,
            integration_id=jira_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
            },
            data={
                "dynamic_form_fields": [{"project": "PROJECT-1"}],
            },
        )

        jira_action_2 = self.create_action(
            type=Action.Type.JIRA,
            integration_id=jira_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
            },
            data={
                "dynamic_form_fields": [{"project": "PROJECT-1"}],
            },
        )

        actions_queryset = Action.objects.filter(id__in=[jira_action_1.id, jira_action_2.id])
        action_to_workflow_ids = {jira_action_1.id: 1, jira_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Only 1 action should remain
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        assert result_ids[0] == jira_action_1.id

    def test_deduplicate_actions_empty_queryset(self) -> None:
        """Test deduplication with empty queryset."""
        actions_queryset = Action.objects.none()
        action_to_workflow_ids: dict[int, int] = {}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Should return empty queryset
        assert list(result) == []

    def test_deduplicate_actions_single_action(self) -> None:
        """Test deduplication with single action."""
        single_action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.slack_integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "channel-123",
                "target_display": "Test Channel",
            },
        )

        actions_queryset = Action.objects.filter(id=single_action.id)
        action_to_workflow_ids = {single_action.id: 1}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # Should return the single action
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        assert result_ids[0] == single_action.id

    def test_deduplicate_actions_preserves_action_with_lower_id(self) -> None:
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

        # Ensure we know which has the lower ID
        higher_id_action = (
            slack_action_2 if slack_action_2.id > slack_action_1.id else slack_action_1
        )
        lower_id_action = (
            slack_action_1 if slack_action_2.id > slack_action_1.id else slack_action_2
        )

        actions_queryset = Action.objects.filter(id__in=[slack_action_1.id, slack_action_2.id])
        action_to_workflow_ids = {slack_action_1.id: 1, slack_action_2.id: 2}

        result = deduplicate_actions(actions_queryset, action_to_workflow_ids)

        # The action with lower ID should be kept
        result_ids = list(result.values_list("id", flat=True))
        assert len(result_ids) == 1
        assert result_ids[0] == lower_id_action.id
        assert higher_id_action.id not in result_ids
