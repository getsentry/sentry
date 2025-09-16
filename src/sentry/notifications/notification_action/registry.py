from sentry.utils.registry import Registry

from .types import (
    BaseActionValidatorHandler,
    BaseIssueAlertHandler,
    BaseMetricAlertHandler,
    LegacyRegistryHandler,
)

metric_alert_handler_registry = Registry[type[BaseMetricAlertHandler]](enable_reverse_lookup=False)
issue_alert_handler_registry = Registry[type[BaseIssueAlertHandler]](enable_reverse_lookup=False)
group_type_notification_registry = Registry[type[LegacyRegistryHandler]]()
action_validator_registry = Registry[type[BaseActionValidatorHandler]](enable_reverse_lookup=False)
