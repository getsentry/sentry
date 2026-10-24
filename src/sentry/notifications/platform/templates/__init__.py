from .data_export import DataExportFailureTemplate, DataExportSuccessTemplate
from .deploy import DeployReleaseTemplate
from .issue import IssueNotificationTemplate
from .metric_alert import MetricAlertNotificationTemplate
from .repository import UnableToDeleteRepositoryTemplate
from .sentry_app_webhook_disabled import SentryAppWebhookDisabledTemplate

__all__ = (
    "DataExportSuccessTemplate",
    "DataExportFailureTemplate",
    "IssueNotificationTemplate",
    "MetricAlertNotificationTemplate",
    "SentryAppWebhookDisabledTemplate",
    "DeployReleaseTemplate",
    "UnableToDeleteRepositoryTemplate",
)
# All templates should be imported here so they are registered in the notifications Django app.
# See sentry/notifications/apps.py
# The exception is `.seer`, which apps.py imports directly: this package is imported while
# sentry.api.serializers is initializing, and `.seer` depends on sentry.api.serializers.

from .activity import *  # noqa: F401,F403
from .sample import *  # noqa: F401,F403
