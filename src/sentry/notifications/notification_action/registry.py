from sentry.utils.registry import Registry

from .types import BaseIssueAlertHandler, BaseMetricAlertHandler, LegacyRegistryHandler

metric_alert_handler_registry = Registry[BaseMetricAlertHandler](enable_reverse_lookup=False)
issue_alert_handler_registry = Registry[BaseIssueAlertHandler](enable_reverse_lookup=False)
group_type_notification_registry = Registry[LegacyRegistryHandler]()
