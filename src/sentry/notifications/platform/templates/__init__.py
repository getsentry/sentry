from .data_export import DataExportFailureTemplate, DataExportSuccessTemplate
from .issue import IssueNotificationTemplate
from .metric_alert import MetricAlertNotificationTemplate
from .sentry_app_webhook_disabled import SentryAppWebhookDisabledTemplate

__all__ = (
    "DataExportSuccessTemplate",
    "DataExportFailureTemplate",
    "IssueNotificationTemplate",
    "MetricAlertNotificationTemplate",
    "SentryAppWebhookDisabledTemplate",
)
# All templates should be imported here so they are registered in the notifications Django app.
# See sentry/notifications/apps.py

from .sample import *  # noqa: F401,F403
