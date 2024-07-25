from dataclasses import dataclass

from sentry.incidents.models.alert_rule import AlertRuleTriggerAction, FactoryRegistry


@dataclass(frozen=True)
class TemporaryAlertRuleTriggerActionRegistry:
    _suspended_values: FactoryRegistry

    @classmethod
    def suspend(cls) -> "TemporaryAlertRuleTriggerActionRegistry":
        obj = cls(AlertRuleTriggerAction.factory_registrations)
        AlertRuleTriggerAction.factory_registrations = FactoryRegistry()
        return obj

    def restore(self) -> None:
        AlertRuleTriggerAction.factory_registrations = self._suspended_values
