from contextlib import contextmanager
from dataclasses import dataclass

from sentry.incidents.models.alert_rule import AlertRuleTriggerAction, _FactoryRegistry


@dataclass(frozen=True)
class TemporaryAlertRuleTriggerActionRegistry:
    _suspended_values: _FactoryRegistry

    @classmethod
    def suspend(cls) -> "TemporaryAlertRuleTriggerActionRegistry":
        obj = cls(AlertRuleTriggerAction._factory_registrations)
        AlertRuleTriggerAction._factory_registrations = _FactoryRegistry()
        return obj

    def restore(self) -> None:
        AlertRuleTriggerAction._factory_registrations = self._suspended_values

    @classmethod
    @contextmanager
    def registry_patched(cls):
        suspended = cls.suspend()
        try:
            yield
        finally:
            suspended.restore()
