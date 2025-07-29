from sentry.notifications.models.notificationaction import ActionTarget
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_regions
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.service.action.service import action_service
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier


@all_silo_test(regions=create_test_regions("us"))
class TestActionService(TestCase):
    def setUp(self) -> None:
        self.organization = self.create_organization(owner=self.user)
        self.organization_2 = self.create_organization(owner=self.user)

        self.integration = self.create_integration(
            organization=self.organization,
            provider="slack",
            name="Test Integration",
            external_id="123",
        )
        self.integration_2 = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Test Integration 2",
            external_id="456",
        )

        self.sentry_app = self.create_sentry_app(
            organization=self.organization, name="Test Sentry App"
        )
        self.sentry_app_2 = self.create_sentry_app(
            organization=self.organization, name="Test Sentry App 2"
        )

    def test_delete_actions_for_organization_integration_successful_deletion(self) -> None:
        # Create data condition group linked to the organization
        condition_group = self.create_data_condition_group(organization=self.organization)

        # Create action with integration_id
        action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
        )

        # Link action to condition group
        self.create_data_condition_group_action(condition_group=condition_group, action=action)

        # Call service method
        action_service.delete_actions_for_organization_integration(
            organization_id=self.organization.id, integration_id=self.integration.id
        )

        # Verify action was deleted
        with assume_test_silo_mode(SiloMode.REGION):
            assert not Action.objects.filter(id=action.id).exists()

    def test_delete_actions_for_organization_integration_no_actions_to_delete(self) -> None:
        # Call service method when no actions exist
        action_service.delete_actions_for_organization_integration(
            organization_id=self.organization.id, integration_id=self.integration.id
        )

        # Should not raise any errors, no-op

    def test_delete_actions_for_organization_integration_multiple_actions(self) -> None:
        # Create data condition group linked to the organization
        condition_group = self.create_data_condition_group(organization=self.organization)

        # Create multiple actions with same integration_id
        action_1 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
        )
        action_2 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
        )

        # Create action with different integration_id (should not be deleted)
        action_3 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration_2.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration 2",
            },
        )

        # Link all actions to condition group
        self.create_data_condition_group_action(condition_group=condition_group, action=action_1)
        self.create_data_condition_group_action(condition_group=condition_group, action=action_2)
        self.create_data_condition_group_action(condition_group=condition_group, action=action_3)

        # Call service method
        action_service.delete_actions_for_organization_integration(
            organization_id=self.organization.id, integration_id=self.integration.id
        )

        # Verify only actions with matching integration_id were deleted
        with assume_test_silo_mode(SiloMode.REGION):
            assert not Action.objects.filter(id=action_1.id).exists()
            assert not Action.objects.filter(id=action_2.id).exists()
            assert Action.objects.filter(id=action_3.id).exists()

    def test_delete_actions_for_organization_integration_wrong_organization(self) -> None:
        # Create data condition group linked to different organization
        condition_group = self.create_data_condition_group(organization=self.organization_2)

        # Create action with integration_id
        action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
        )

        # Link action to condition group of different organization
        self.create_data_condition_group_action(condition_group=condition_group, action=action)

        # Call service method with original organization
        action_service.delete_actions_for_organization_integration(
            organization_id=self.organization.id, integration_id=self.integration.id
        )

        # Action should still exist since it belongs to different organization
        with assume_test_silo_mode(SiloMode.REGION):
            assert Action.objects.filter(id=action.id).exists()

    def test_delete_actions_for_organization_integration_mixed_types(self) -> None:
        # Create data condition group linked to the organization
        condition_group = self.create_data_condition_group(organization=self.organization)

        # Create action with integration_id that should be deleted
        integration_action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
        )

        # Create action with sentry_app_id that should NOT be deleted
        sentry_app_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )

        # Link both actions to condition group
        self.create_data_condition_group_action(
            condition_group=condition_group, action=integration_action
        )
        self.create_data_condition_group_action(
            condition_group=condition_group, action=sentry_app_action
        )

        # Call service method for integration
        action_service.delete_actions_for_organization_integration(
            organization_id=self.organization.id, integration_id=self.integration.id
        )

        # Verify only integration action was deleted
        with assume_test_silo_mode(SiloMode.REGION):
            assert not Action.objects.filter(id=integration_action.id).exists()
            assert Action.objects.filter(id=sentry_app_action.id).exists()
