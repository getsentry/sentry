__all__ = ["group_type_notification_registry", "issue_alert_handler_registry"]

from sentry.utils.registry import Registry

from .issue_alert_registry import issue_alert_handler_registry
from .types import LegacyRegistryHandler

group_type_notification_registry = Registry[LegacyRegistryHandler]()
