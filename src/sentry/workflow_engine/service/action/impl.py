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
