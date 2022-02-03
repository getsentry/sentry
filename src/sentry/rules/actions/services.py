from typing import Any


class PluginService:
    def __init__(self, obj: Any) -> None:
        self.service = obj

    @property
    def slug(self) -> str:
        _slug: str = self.service.slug
        return _slug

    @property
    def title(self) -> str:
        _title: str = self.service.get_title()
        return _title

    @property
    def service_type(self) -> str:
        return "plugin"


class LegacyPluginService(PluginService):
    def __init__(self, obj: Any) -> None:
        super().__init__(obj)
        self.service = obj

    @property
    def service_type(self) -> str:
        return "legacy_plugin"


class SentryAppService(PluginService):
    def __init__(self, obj: Any) -> None:
        super().__init__(obj)
        self.service = obj

    @property
    def title(self) -> str:
        _title: str = self.service.name
        return _title

    @property
    def service_type(self) -> str:
        return "sentry_app"

    def has_alert_rule_action(self) -> bool:
        from sentry.models import SentryAppComponent

        exists: bool = SentryAppComponent.objects.filter(
            sentry_app_id=self.service.id, type="alert-rule-action"
        ).exists()
        return exists
