__all__ = ["metric_alert_handler_registry"]

from sentry.utils.registry import Registry

from .base import BaseMetricAlertHandler

metric_alert_handler_registry = Registry[BaseMetricAlertHandler](enable_reverse_lookup=False)
