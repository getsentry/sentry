from sentry.models.notificationaction import ActionService

PROVIDER = "pagerduty"


class PagerDutyOnCallSpec:
    @property
    def provider_slug(self) -> str:
        return PROVIDER

    @property
    def action_service(self) -> ActionService:
        return ActionService.PAGERDUTY
