"""
The repository classes are responsible for the interactions with the data store for the NotificationMessage data model.
The classes help separate the query interface with the actual data store for the NotificationMessage data model.

If we scale quickly, the current NotificationMessage data model will have to shift from django postgres to
snuba clickhouse, and these classes will help keep the changes consolidated to here.
For self-hosted, if the user wants to utilize another datastore, they are able to do so.

What we query from an interface level won't change, simply how we query will change, and these classes should be the
only thing that need to change after we make the migration.
"""

from sentry.integrations.repository.issue_alert import IssueAlertNotificationMessageRepository
from sentry.integrations.repository.metric_alert import MetricAlertNotificationMessageRepository
from sentry.integrations.repository.notification_action import (
    NotificationActionNotificationMessageRepository,
)

_default_metric_alert_repository = None
_default_issue_alert_repository = None
_default_notification_action_repository = None


def get_default_metric_alert_repository() -> MetricAlertNotificationMessageRepository:
    global _default_metric_alert_repository
    if _default_metric_alert_repository is None:
        _default_metric_alert_repository = MetricAlertNotificationMessageRepository.default()

    return _default_metric_alert_repository


def get_default_issue_alert_repository() -> IssueAlertNotificationMessageRepository:
    global _default_issue_alert_repository
    if _default_issue_alert_repository is None:
        _default_issue_alert_repository = IssueAlertNotificationMessageRepository.default()

    return _default_issue_alert_repository


def get_default_notification_action_repository() -> NotificationActionNotificationMessageRepository:
    global _default_notification_action_repository
    if _default_notification_action_repository is None:
        _default_notification_action_repository = (
            NotificationActionNotificationMessageRepository.default()
        )

    return _default_notification_action_repository
