from sentry.workflow_engine.models import Action
from sentry.workflow_engine.service.action.service import ActionService
from sentry.workflow_engine.typings.notification_action import SentryAppIdentifier


class DatabaseBackedActionService(ActionService):
    def delete_actions_for_organization_integration(
        self, *, organization_id: int, integration_id: int
    ) -> None:
        """
        Delete all actions given an organization_id and integration_id.
        """

        Action.objects.filter(
            integration_id=integration_id,
            dataconditiongroupaction__condition_group__organization_id=organization_id,
        ).delete()

    def update_action_status_for_organization_integration(
        self, *, organization_id: int, integration_id: int, status: int
    ) -> None:
        """
        Update the status of all actions given an organization_id and integration_id.
        """

        Action.objects.filter(
            integration_id=integration_id,
            dataconditiongroupaction__condition_group__organization_id=organization_id,
        ).update(status=status)

    def update_action_status_for_sentry_app(
        self,
        *,
        organization_id: int,
        status: int,
        sentry_app_install_uuid: str | None = None,
        sentry_app_id: int | None = None,
    ) -> None:
        if (not sentry_app_install_uuid and not sentry_app_id) or (
            sentry_app_install_uuid and sentry_app_id
        ):
            raise ValueError("Either sentry_app_install_uuid or sentry_app_id must be provided")

        sentry_app_identifier = (
            SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID
            if sentry_app_install_uuid
            else SentryAppIdentifier.SENTRY_APP_ID
        )
        target_identifier = (
            sentry_app_install_uuid if sentry_app_install_uuid else str(sentry_app_id)
        )

        Action.objects.filter(
            type=Action.Type.SENTRY_APP,
            config__sentry_app_identifier=sentry_app_identifier,
            config__target_identifier=target_identifier,
        ).update(status=status)
