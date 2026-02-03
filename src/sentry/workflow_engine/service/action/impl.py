from django.db.models import Q

from sentry.constants import SentryAppInstallationStatus
from sentry.sentry_apps.services.app.service import app_service
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.service.action.service import ActionService


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

    def update_action_status_for_sentry_app_via_uuid(
        self,
        *,
        organization_id: int,
        status: int,
        sentry_app_install_uuid: str,
        sentry_app_id: str,
    ) -> None:
        Action.objects.filter(
            Q(config__target_identifier=sentry_app_install_uuid)
            | Q(config__target_identifier=str(sentry_app_id)),
            type=Action.Type.SENTRY_APP,
        ).update(status=status)

    def update_action_status_for_sentry_app_via_uuid__region(
        self,
        *,
        region_name: str,
        status: int,
        sentry_app_install_uuid: str,
        sentry_app_id: int,
    ) -> None:
        actions = Action.objects.filter(
            Q(config__target_identifier=sentry_app_install_uuid)
            | Q(config__target_identifier=str(sentry_app_id)),
            type=Action.Type.SENTRY_APP,
        )
        actions.update(status=status)

    def update_action_status_for_sentry_app_via_sentry_app_id(
        self,
        *,
        region_name: str,
        status: int,
        sentry_app_id: int,
    ) -> None:
        # look up all installs and disable the action - if the sentry app no longer exists, no related actions can fire
        installs = app_service.get_many(
            filter={
                "sentry_app__id": sentry_app_id,
                "status": SentryAppInstallationStatus.INSTALLED,
            }
        )

        Action.objects.filter(
            Q(config__target_identifier=str(sentry_app_id))
            | Q(config__target_identifier__in=[install.uuid for install in installs]),
            type=Action.Type.SENTRY_APP,
        ).update(status=status)

    def update_action_status_for_webhook_via_sentry_app_slug(
        self,
        *,
        region_name: str,
        status: int,
        sentry_app_slug: str,
    ) -> None:
        Action.objects.filter(
            type=Action.Type.WEBHOOK,
            config__target_identifier=sentry_app_slug,
        ).update(status=status)
