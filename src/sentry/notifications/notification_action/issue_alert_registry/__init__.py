__all__ = ["issue_alert_handler_registry"]

from sentry.utils.registry import Registry

from .base import BaseIssueAlertHandler

issue_alert_handler_registry = Registry[BaseIssueAlertHandler](enable_reverse_lookup=False)
