from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.migration_helpers.rule_action import (
    translate_rule_data_actions_to_notification_actions,
)
from sentry.workflow_engine.models import Action

EMAIL_ACTION_REGISTRY_ID = "sentry.mail.actions.NotifyEmailAction"


class FixEmailActionFallthroughTypeTest(TestMigrations):
    migrate_from = "0106_migrate_actions_sentry_app_data"
    migrate_to = "0107_fix_email_action_fallthrough_type"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.org)

        # Create rule with 2 email actions (different fallthroughType) + 1 plugin action
        self.rule1 = self.create_project_rule(
            project=self.project,
            action_data=[
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetType": "IssueOwners",
                    "fallthroughType": "ActiveMembers",
                },
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetType": "IssueOwners",
                    "fallthroughType": "NoOne",
                },
                {
                    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
                },
            ],
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            ],
        )

        # Migrate rule1 to workflow
        self.workflow1 = IssueAlertMigrator(self.rule1).run()

        # Simulate the bug: update all email actions to have wrong data/config
        email_actions_1 = Action.objects.filter(
            dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow_id=self.workflow1.id,
            type="email",
        ).order_by("id")

        for action in email_actions_1:
            # Overwrite with wrong data to simulate the bug
            action.data.update({"fallthrough_type": "ActiveMembers"})
            action.save()

        # Store original plugin action data for comparison
        self.plugin_action_1 = Action.objects.filter(
            dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow_id=self.workflow1.id,
            type="plugin",
        ).first()
        self.plugin_action_1_original_data = (
            self.plugin_action_1.data.copy() if self.plugin_action_1 else {}
        )
        self.plugin_action_1_original_config = (
            self.plugin_action_1.config.copy() if self.plugin_action_1 else {}
        )

        # Create another rule with a webhook action (NotifyEventServiceAction)
        self.rule2 = self.create_project_rule(
            project=self.project,
            action_data=[
                {
                    "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                    "service": "mail",
                },
            ],
            condition_data=[
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            ],
        )

        # Migrate rule2 to workflow
        self.workflow2 = IssueAlertMigrator(self.rule2).run()

        # Store original webhook action data for comparison
        self.webhook_action = Action.objects.filter(
            dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow_id=self.workflow2.id,
            type="webhook",
        ).first()
        self.webhook_action_original_data = (
            self.webhook_action.data.copy() if self.webhook_action else {}
        )
        self.webhook_action_original_config = (
            self.webhook_action.config.copy() if self.webhook_action else {}
        )

    def test_migration(self) -> None:
        self._test_migration_fixes_email_actions()
        self._test_migration_does_not_change_non_email_actions()

    def _test_migration_fixes_email_actions(self) -> None:
        """
        Verify the migration produces the same Action state as translate_rule_data_actions_to_notification_actions.
        """
        # Get the email actions for workflow1 after migration
        email_actions = list(
            Action.objects.filter(
                dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow_id=self.workflow1.id,
                type="email",
            ).order_by("id")
        )

        # Get the rule's email actions and translate them using the helper function
        rule_email_actions = [
            action
            for action in self.rule1.data["actions"]
            if action.get("id") == EMAIL_ACTION_REGISTRY_ID
        ]
        expected_actions = translate_rule_data_actions_to_notification_actions(
            rule_email_actions, skip_failures=True
        )

        assert len(email_actions) == len(expected_actions) == 2

        # Compare each migrated action to what the helper function produces
        for i, (migrated_action, expected_action) in enumerate(
            zip(email_actions, expected_actions)
        ):
            assert migrated_action.type == expected_action.type, (
                f"Action {i}: type mismatch - "
                f"got {migrated_action.type}, expected {expected_action.type}"
            )
            assert migrated_action.data == expected_action.data, (
                f"Action {i}: data mismatch - "
                f"got {migrated_action.data}, expected {expected_action.data}"
            )
            assert migrated_action.config == expected_action.config, (
                f"Action {i}: config mismatch - "
                f"got {migrated_action.config}, expected {expected_action.config}"
            )
            assert migrated_action.integration_id == expected_action.integration_id, (
                f"Action {i}: integration_id mismatch - "
                f"got {migrated_action.integration_id}, expected {expected_action.integration_id}"
            )

    def _test_migration_does_not_change_non_email_actions(self) -> None:
        # Check that the plugin action in workflow1 is unchanged
        if self.plugin_action_1:
            self.plugin_action_1.refresh_from_db()
            assert self.plugin_action_1.data == self.plugin_action_1_original_data
            assert self.plugin_action_1.config == self.plugin_action_1_original_config

        # Check that the webhook action in workflow2 is unchanged
        if self.webhook_action:
            self.webhook_action.refresh_from_db()
            assert self.webhook_action.data == self.webhook_action_original_data
            assert self.webhook_action.config == self.webhook_action_original_config
