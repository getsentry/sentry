from sentry.models.notificationaction import ActionService


class OnCallSpec:
    provider: str

    def __init__(self, provider):
        self.provider = provider

    @property
    def provider_slug(self) -> str:
        return self.provider

    @property
    def action_service(self) -> ActionService:
        return ActionService.PAGERDUTY if self.provider == "pagerduty" else ActionService.OPSGENIE
