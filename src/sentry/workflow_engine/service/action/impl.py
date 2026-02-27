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

    def update_action_status_for_sentry_app_installation(
        self,
        *,
        region_name: str,
        status: int,
        organization_id: int,
        sentry_app_id: int,
    ) -> None:
        Action.objects.filter(
            config__target_identifier=str(sentry_app_id),
            type=Action.Type.SENTRY_APP,
            dataconditiongroupaction__condition_group__organization_id=organization_id,
        ).update(status=status)

    def update_action_status_for_sentry_app_via_sentry_app_id(
        self,
        *,
        region_name: str,
        status: int,
        sentry_app_id: int,
    ) -> None:
        Action.objects.filter(
            config__target_identifier=str(sentry_app_id),
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
