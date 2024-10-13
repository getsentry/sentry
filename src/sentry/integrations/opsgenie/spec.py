from sentry.models.notificationaction import ActionService

PROVIDER = "opsgenie"


class OpsgenieOnCallSpec:
    @property
    def provider_slug(self) -> str:
        return PROVIDER

    @property
    def action_service(self) -> ActionService:
        return ActionService.OPSGENIE
