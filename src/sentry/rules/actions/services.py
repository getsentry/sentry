from typing import Any


class SentryAppService:
    def __init__(self, obj: Any) -> None:
        self.service = obj

    @property
    def slug(self) -> str:
        _slug: str = self.service.slug
        return _slug

    @property
    def title(self) -> str:
        _title: str = self.service.name
        return _title

    @property
    def service_type(self) -> str:
        return "sentry_app"

    def has_alert_rule_action(self) -> bool:
        from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent

        exists: bool = SentryAppComponent.objects.filter(
            sentry_app_id=self.service.id, type="alert-rule-action"
        ).exists()
        return exists
