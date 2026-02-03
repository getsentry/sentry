from sentry.constants import ObjectStatus
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
        condition_group = self.create_data_condition_group(organization=self.organization)

        action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
        )

        self.create_data_condition_group_action(condition_group=condition_group, action=action)

        action_service.delete_actions_for_organization_integration(
            organization_id=self.organization.id, integration_id=self.integration.id
        )

        with assume_test_silo_mode(SiloMode.REGION):
            assert not Action.objects.filter(id=action.id).exists()

    def test_delete_actions_for_organization_integration_multiple_actions(self) -> None:
        condition_group = self.create_data_condition_group(organization=self.organization)

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

        action_3 = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration_2.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration 2",
            },
        )

        self.create_data_condition_group_action(condition_group=condition_group, action=action_1)
        self.create_data_condition_group_action(condition_group=condition_group, action=action_2)
        self.create_data_condition_group_action(condition_group=condition_group, action=action_3)

        action_service.delete_actions_for_organization_integration(
            organization_id=self.organization.id, integration_id=self.integration.id
        )

        with assume_test_silo_mode(SiloMode.REGION):
            assert not Action.objects.filter(id=action_1.id).exists()
            assert not Action.objects.filter(id=action_2.id).exists()
            assert Action.objects.filter(id=action_3.id).exists()

    def test_delete_actions_for_organization_integration_wrong_organization(self) -> None:
        condition_group = self.create_data_condition_group(organization=self.organization_2)

        action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
        )

        self.create_data_condition_group_action(condition_group=condition_group, action=action)

        action_service.delete_actions_for_organization_integration(
            organization_id=self.organization.id, integration_id=self.integration.id
        )

        with assume_test_silo_mode(SiloMode.REGION):
            assert Action.objects.filter(id=action.id).exists()

    def test_delete_actions_for_organization_integration_mixed_types(self) -> None:
        condition_group = self.create_data_condition_group(organization=self.organization)

        integration_action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
        )

        sentry_app_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )

        self.create_data_condition_group_action(
            condition_group=condition_group, action=integration_action
        )
        self.create_data_condition_group_action(
            condition_group=condition_group, action=sentry_app_action
        )

        action_service.delete_actions_for_organization_integration(
            organization_id=self.organization.id, integration_id=self.integration.id
        )

        with assume_test_silo_mode(SiloMode.REGION):
            assert not Action.objects.filter(id=integration_action.id).exists()
            assert Action.objects.filter(id=sentry_app_action.id).exists()

    def test_disable_actions_for_organization_integration_mixed_types(self) -> None:
        condition_group = self.create_data_condition_group(organization=self.organization)

        integration_action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
        )

        sentry_app_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )

        self.create_data_condition_group_action(
            condition_group=condition_group, action=integration_action
        )
        self.create_data_condition_group_action(
            condition_group=condition_group, action=sentry_app_action
        )

        action_service.update_action_status_for_organization_integration(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            status=ObjectStatus.DISABLED,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            action = Action.objects.filter(id=integration_action.id).first()
            assert action is not None
            assert action.status == ObjectStatus.DISABLED

            action = Action.objects.filter(id=sentry_app_action.id).first()
            assert action is not None
            assert action.status == ObjectStatus.ACTIVE

    def test_enable_actions_for_organization_integration_mixed_types(self) -> None:
        condition_group = self.create_data_condition_group(organization=self.organization)

        integration_action = self.create_action(
            type=Action.Type.SLACK,
            integration_id=self.integration.id,
            config={
                "target_type": ActionTarget.SPECIFIC,
                "target_identifier": "123",
                "target_display": "Test Integration",
            },
            status=ObjectStatus.DISABLED,
        )

        sentry_app_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP,
            },
            status=ObjectStatus.DISABLED,
        )

        self.create_data_condition_group_action(
            condition_group=condition_group, action=integration_action
        )
        self.create_data_condition_group_action(
            condition_group=condition_group, action=sentry_app_action
        )

        action_service.update_action_status_for_organization_integration(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            status=ObjectStatus.ACTIVE,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            action = Action.objects.filter(id=integration_action.id).first()
            assert action is not None
            assert action.status == ObjectStatus.ACTIVE

            action = Action.objects.filter(id=sentry_app_action.id).first()
            assert action is not None
            assert action.status == ObjectStatus.DISABLED

    def test_update_action_status_for_sentry_app__installation_uuid(self) -> None:
        sentry_app_installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug,
            organization=self.organization,
        )
        installation_uuid_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": sentry_app_installation.uuid,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )
        sentry_app_id_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )

        action_service.update_action_status_for_sentry_app_via_uuid(
            organization_id=self.organization.id,
            sentry_app_install_uuid=sentry_app_installation.uuid,
            sentry_app_id=sentry_app_installation.sentry_app.id,
            status=ObjectStatus.DISABLED,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            installation_uuid_action.refresh_from_db()
            sentry_app_id_action.refresh_from_db()
            assert installation_uuid_action.status == ObjectStatus.DISABLED
            assert sentry_app_id_action.status == ObjectStatus.DISABLED

    def test_update_action_status_for_sentry_app__installation_uuid__region(self) -> None:
        sentry_app_installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug,
            organization=self.organization,
        )
        installation_uuid_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": sentry_app_installation.uuid,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )
        sentry_app_id_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )
        action_service.update_action_status_for_sentry_app_via_uuid__region(
            region_name="us",
            sentry_app_install_uuid=sentry_app_installation.uuid,
            sentry_app_id=sentry_app_installation.sentry_app.id,
            status=ObjectStatus.DISABLED,
        )
        with assume_test_silo_mode(SiloMode.REGION):
            installation_uuid_action.refresh_from_db()
            sentry_app_id_action.refresh_from_db()
            assert installation_uuid_action.status == ObjectStatus.DISABLED
            assert sentry_app_id_action.status == ObjectStatus.DISABLED

    def test_update_action_status_for_sentry_app__via_sentry_app_id(self) -> None:
        sentry_app_installation = self.create_sentry_app_installation(
            slug=self.sentry_app.slug,
            organization=self.organization,
        )
        installation_uuid_action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": sentry_app_installation.uuid,
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )

        action = self.create_action(
            type=Action.Type.SENTRY_APP,
            config={
                "target_identifier": str(self.sentry_app.id),
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_ID,
                "target_type": ActionTarget.SENTRY_APP,
            },
        )
        action_service.update_action_status_for_sentry_app_via_sentry_app_id(
            region_name="us",
            sentry_app_id=self.sentry_app.id,
            status=ObjectStatus.DISABLED,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            action.refresh_from_db()
            installation_uuid_action.refresh_from_db()
            assert action.status == ObjectStatus.DISABLED
            assert installation_uuid_action.status == ObjectStatus.DISABLED

    def test_update_action_status_for_webhook_via_sentry_app_slug(self) -> None:
        action = self.create_action(
            type=Action.Type.WEBHOOK,
            config={
                "target_identifier": self.sentry_app.slug,
            },
        )
        action_service.update_action_status_for_webhook_via_sentry_app_slug(
            region_name="us",
            sentry_app_slug=self.sentry_app.slug,
            status=ObjectStatus.DISABLED,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            action.refresh_from_db()
            assert action.status == ObjectStatus.DISABLED
